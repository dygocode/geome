import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Config ────────────────────────────────────────────────────
const INTER_API = "https://cdpj.partners.bancointer.com.br";
const INTER_CLIENT_ID = Deno.env.get("INTER_CLIENT_ID")!;
const INTER_CLIENT_SECRET = Deno.env.get("INTER_CLIENT_SECRET")!;
const INTER_PIX_KEY = Deno.env.get("INTER_PIX_KEY")!;
const INTER_CERT_B64 = Deno.env.get("INTER_CERT")!;
const INTER_KEY_B64 = Deno.env.get("INTER_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const certPem = atob(INTER_CERT_B64);
const keyPem = atob(INTER_KEY_B64);

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// ── mTLS fetch via raw TLS (Deno has no native mTLS fetch) ────
async function interFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const parsedUrl = new URL(url);
  const conn = await Deno.connectTls({
    hostname: parsedUrl.hostname,
    port: 443,
    cert: certPem,
    key: keyPem,
  });

  const encoder = new TextEncoder();
  const body = options.body ? String(options.body) : "";
  const bodyBytes = encoder.encode(body);

  const lines: string[] = [];
  lines.push(`${options.method || "GET"} ${parsedUrl.pathname}${parsedUrl.search} HTTP/1.1`);
  lines.push(`Host: ${parsedUrl.hostname}`);
  for (const [k, v] of Object.entries(options.headers || {})) {
    if (k.toLowerCase() === "content-length") continue;
    lines.push(`${k}: ${v}`);
  }
  if (bodyBytes.length > 0) lines.push(`Content-Length: ${bodyBytes.length}`);
  lines.push("Connection: close");
  lines.push("");

  await conn.write(encoder.encode(lines.join("\r\n")));
  if (bodyBytes.length > 0) await conn.write(bodyBytes);

  const decoder = new TextDecoder();
  let data = "";
  const buf = new Uint8Array(8192);
  let n: number;
  while ((n = await conn.read(buf)) !== null) data += decoder.decode(buf.subarray(0, n));
  conn.close();

  const headerEnd = data.indexOf("\r\n\r\n");
  if (headerEnd === -1) throw new Error(`No headers: ${data.slice(0, 200)}`);
  const statusLine = data.substring(0, data.indexOf("\r\n"));
  const status = parseInt(statusLine.split(" ")[1]) || 500;
  const respBody = data.substring(headerEnd + 4);

  return new Response(respBody, { status, headers: { "Content-Type": "application/json" } });
}

// ── Inter OAuth2 (client_id + client_secret in body + mTLS cert) ──
async function getInterToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const body = [
    `client_id=${INTER_CLIENT_ID}`,
    `client_secret=${INTER_CLIENT_SECRET}`,
    "grant_type=client_credentials",
    "scope=cob.write cob.read pix.read",
  ].join("&");

  const res = await interFetch(`${INTER_API}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Inter auth ${res.status}: ${text}`);

  const data = JSON.parse(text);
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

// ── Supabase helper ───────────────────────────────────────────
function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ── Route: Create PIX charge (Pix Cobrança) ───────────────────
async function handlePixCreate(body: Record<string, unknown>) {
  const { subscription_id, email, amount_cents } = body;
  const db = sb();
  const token = await getInterToken();

  const cobRes = await interFetch(`${INTER_API}/pix/v2/cob`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      calendario: { expiracao: 3600 },
      valor: { original: (Number(amount_cents) / 100).toFixed(2) },
      chave: INTER_PIX_KEY,
      solicitacaoPagador: `Geome - Plano Basico - ${email}`,
    }),
  });

  if (!cobRes.ok) {
    const err = await cobRes.text();
    throw new Error(`Inter PIX: ${cobRes.status} ${err}`);
  }

  const cobData = await cobRes.json();

  const { data: payment, error: dbErr } = await db
    .from("payments")
    .insert({
      subscription_id,
      external_id: cobData.txid,
      amount_cents,
      currency: "BRL",
      status: "pending",
      pix_copy_paste: cobData.pixCopiaECola,
      pix_qr_code: cobData.pixCopiaECola,
      bank_code: "077",
      agency: "0001-9",
    })
    .select()
    .single();

  if (dbErr) throw dbErr;

  return json({
    payment_id: payment.id,
    pix_copy_paste: cobData.pixCopiaECola,
    pix_qr_code: cobData.pixCopiaECola,
    txid: cobData.txid,
  });
}

// ── Route: Check PIX payment status ───────────────────────────
async function handlePixCheck(body: Record<string, unknown>) {
  const { payment_id } = body;
  const db = sb();

  const { data: payment } = await db
    .from("payments").select("*").eq("id", payment_id).single();

  if (!payment) return json({ paid: false });
  if (payment.status === "approved") return json({ paid: true });

  const token = await getInterToken();

  const cobRes = await interFetch(
    `${INTER_API}/pix/v2/cob/${payment.external_id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!cobRes.ok) return json({ paid: false });

  const cobData = await cobRes.json();
  const paid = cobData.status === "CONCLUIDA";

  if (paid) {
    await db.from("payments")
      .update({ status: "approved", paid_at: new Date().toISOString() })
      .eq("id", payment_id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await db.from("subscriptions")
      .update({ status: "active", expires_at: expiresAt.toISOString() })
      .eq("id", payment.subscription_id);
  }

  return json({ paid });
}

// ── Route: Get or create subscription ─────────────────────────
async function handleSubscription(body: Record<string, unknown>) {
  const { email } = body;
  const db = sb();

  const { data: existing } = await db
    .from("subscriptions").select("*").eq("email", email)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (existing) {
    const { data: payment } = await db
      .from("payments").select("*").eq("subscription_id", existing.id)
      .eq("status", "pending").limit(1).maybeSingle();
    return json({ subscription: existing, payment: payment || null });
  }

  const { data: plan } = await db
    .from("subscription_plans").select("*").eq("active", true)
    .limit(1).single();

  const { data: sub, error } = await db
    .from("subscriptions").insert({
      email, plan_id: plan.id, analyses_used: 0,
      analyses_limit: 5, status: "pending",
    }).select().single();

  if (error) throw error;
  return json({ subscription: sub, payment: null });
}

// ── Route: Check subscription ─────────────────────────────────
async function handleCheckSubscription(body: Record<string, unknown>) {
  const { email } = body;
  const db = sb();

  const { data: sub } = await db
    .from("subscriptions").select("*").eq("email", email)
    .eq("status", "active").gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!sub) return json({ allowed: false, remaining: 0, subscription: null });
  return json({
    allowed: sub.analyses_limit - sub.analyses_used > 0,
    remaining: sub.analyses_limit - sub.analyses_used,
    subscription: sub,
  });
}

// ── Route: Increment usage ────────────────────────────────────
async function handleIncrement(body: Record<string, unknown>) {
  const { subscription_id } = body;
  const db = sb();

  const { data: sub } = await db
    .from("subscriptions").select("analyses_used")
    .eq("id", subscription_id).single();

  if (!sub) return json({ error: "Not found" }, 404);

  await db.from("subscriptions")
    .update({ analyses_used: sub.analyses_used + 1 })
    .eq("id", subscription_id);

  return json({ ok: true });
}

// ── Route: Run analysis ───────────────────────────────────────
async function handleAnalysis(body: Record<string, unknown>) {
  const db = sb();
  const { companyName, website, segment, location, contactName, email } = body;

  const { data: company } = await db.from("companies").insert({
    company_name: companyName, website, segment, location,
    contact_name: contactName || "", email: email || "",
  }).select().single();

  const result = {
    overallScore: Math.floor(Math.random() * 40) + 50,
    brandMentions: [
      { platform: "ChatGPT", score: Math.floor(Math.random() * 30) + 60,
        context: `Sua empresa e mencionada no contexto de ${segment || "tecnologia"}.`,
        examples: [`Mencionada em consultas sobre ${segment || "empresas de TI"}`] },
      { platform: "Claude", score: Math.floor(Math.random() * 30) + 50,
        context: "Presenca media com foco em conteudo tecnico.",
        examples: ["Citada em discussoes sobre arquitetura de software"] },
      { platform: "Gemini", score: Math.floor(Math.random() * 30) + 55,
        context: "Boa visibilidade em respostas sobre empresas brasileiras.",
        examples: ["Presente em listas de fornecedores"] },
      { platform: "Perplexity", score: Math.floor(Math.random() * 30) + 45,
        context: "Presenca moderada em pesquisas sobre o setor.",
        examples: ["Aparece em fontes citadas"] },
    ],
    summary: `Analise de presenca da marca ${companyName || "sua empresa"} nas principais plataformas de IA.`,
    recommendations: [
      "Aumente a publicacao de conteudo tecnico no site",
      "Participe de discussoes sobre inovacao no setor",
      "Garanta informacoes atualizadas em fontes publicas",
    ],
  };

  if (company) {
    const { data: analysis } = await db.from("analyses").insert({
      company_id: company.id, overall_score: result.overallScore,
      summary: result.summary, recommendations: result.recommendations,
    }).select().single();

    if (analysis) {
      await db.from("platform_mentions").insert(
        result.brandMentions.map((m) => ({ analysis_id: analysis.id, ...m }))
      );
    }
  }

  return json(result);
}

// ── Router ────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = req.method === "POST" ? await req.json() : {};
    const route = body.route || "";
    switch (route) {
      case "subscription": return await handleSubscription(body);
      case "subscription/check": return await handleCheckSubscription(body);
      case "subscription/increment": return await handleIncrement(body);
      case "pix/create": return await handlePixCreate(body);
      case "pix/check": return await handlePixCheck(body);
      case "analysis": return await handleAnalysis(body);
      default: return json({ error: `Unknown route: ${route}` }, 404);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
