import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const INTER_API_BASE = "https://api.inter.co";
const INTER_CLIENT_ID = Deno.env.get("INTER_CLIENT_ID")!;
const INTER_CLIENT_SECRET = Deno.env.get("INTER_CLIENT_SECRET")!;
const INTER_PIX_KEY = Deno.env.get("INTER_PIX_KEY")!;
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
    const { subscription_id, email, amount_cents } = await req.json();

    if (!subscription_id || !email || !amount_cents) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = await getAccessToken();

    const txid = `geome${Date.now().toString(36)}`.slice(0, 35);

    const cobRes = await fetch(`${INTER_API_BASE}/pix/v2/cob`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        calendario: { expiracao: 3600 },
        valor: { original: (amount_cents / 100).toFixed(2) },
        chave: INTER_PIX_KEY,
        solicitacaoPagador: `Geome - Plano Basico - ${email}`,
        loc: { tipo: "cob" },
      }),
    });

    if (!cobRes.ok) {
      const err = await cobRes.text();
      throw new Error(`Inter PIX charge failed: ${cobRes.status} ${err}`);
    }

    const cobData = await cobRes.json();

    const qrRes = await fetch(
      `${INTER_API_BASE}/pix/v2/loc/${cobData.loc.id}/qrcode`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const qrData = await qrRes.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: payment, error: dbError } = await supabase
      .from("payments")
      .insert({
        subscription_id,
        external_id: cobData.txid,
        amount_cents,
        currency: "BRL",
        status: "pending",
        pix_copy_paste: qrData.pixCopiaECola,
        pix_qr_code: qrData.imagemQrcode,
        bank_code: "077",
        agency: "0001-9",
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return new Response(
      JSON.stringify({
        payment_id: payment.id,
        pix_copy_paste: qrData.pixCopiaECola,
        pix_qr_code: qrData.imagemQrcode,
        txid: cobData.txid,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
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
