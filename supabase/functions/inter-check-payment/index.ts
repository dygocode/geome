import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const INTER_API_BASE = "https://api.inter.co";
const INTER_CLIENT_ID = Deno.env.get("INTER_CLIENT_ID")!;
const INTER_CLIENT_SECRET = Deno.env.get("INTER_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const credentials = btoa(`${INTER_CLIENT_ID}:${INTER_CLIENT_SECRET}`);

  const res = await fetch(`${INTER_API_BASE}/oauth/v2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Inter auth failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { payment_id } = await req.json();

    if (!payment_id) {
      return new Response(JSON.stringify({ error: "Missing payment_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("id", payment_id)
      .single();

    if (!payment || payment.status !== "pending") {
      return new Response(
        JSON.stringify({ paid: payment?.status === "approved" }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const token = await getAccessToken();

    const cobRes = await fetch(
      `${INTER_API_BASE}/pix/v2/cob/${payment.external_id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!cobRes.ok) {
      return new Response(JSON.stringify({ paid: false }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const cobData = await cobRes.json();
    const paid = cobData.status === "CONCLUIDA";

    if (paid) {
      await supabase
        .from("payments")
        .update({ status: "approved", paid_at: new Date().toISOString() })
        .eq("id", payment_id);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabase
        .from("subscriptions")
        .update({
          status: "active",
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", payment.subscription_id);
    }

    return new Response(JSON.stringify({ paid }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
