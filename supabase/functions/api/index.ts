import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Config ────────────────────────────────────────────────────
const MP_API = "https://api.mercadopago.com";
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://geome-app.vercel.app";

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

const SAFE_SUB_FIELDS = "id, email, plan_id, analyses_used, analyses_limit, status, created_at, expires_at";
const SAFE_PAYMENT_FIELDS = "id, subscription_id, external_id, amount_cents, currency, status, pix_copy_paste, pix_qr_code, ticket_url, created_at";

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ── Mercado Pago API helper ───────────────────────────────────
async function mpFetch(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${MP_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`MP ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ── Route: Create checkout (PIX via Mercado Pago) ─────────────
async function handlePixCreate(body: Record<string, unknown>) {
  const { subscription_id, email } = body;
  const db = sb();

  // Get amount from subscription plan
  const { data: sub } = await db
    .from("subscriptions").select("plan_id").eq("id", subscription_id).single();
  const { data: plan } = await db
    .from("subscription_plans").select("price_cents").eq("id", sub.plan_id).single();

  const amount = Number(plan.price_cents);

  // Create Mercado Pago payment with PIX
  const idempotencyKey = crypto.randomUUID();
  const payment = await mpFetch("/v1/payments", {
    method: "POST",
    headers: { "X-Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      transaction_amount: amount,
      description: "Geome - Plano Basico",
      payment_method_id: "pix",
      payer: { email },
      external_reference: subscription_id,
    }),
  });

  const pixData = payment.point_of_interaction?.transaction_data;

  // Save payment record
  const { data: dbPayment, error: dbErr } = await db
    .from("payments")
    .insert({
      subscription_id,
      external_id: String(payment.id),
      amount_cents: plan.price_cents,
      currency: "BRL",
      status: "pending",
      pix_copy_paste: pixData?.qr_code || "",
      pix_qr_code: pixData?.qr_code_base64 || "",
      bank_code: "mercadopago",
      agency: "pix",
    })
    .select("id")
    .single();

  if (dbErr) throw dbErr;

  return json({
    payment_id: dbPayment.id,
    transaction_id: payment.id,
    qr_code_base64: pixData?.qr_code_base64 || "",
    pix_copy_paste: pixData?.qr_code || "",
    ticket_url: pixData?.ticket_url || "",
  });
}

// ── Route: Check payment status ───────────────────────────────
async function handlePixCheck(body: Record<string, unknown>) {
  const { payment_id } = body;
  const db = sb();

  const { data: payment } = await db
    .from("payments").select("id, subscription_id, external_id, status").eq("id", payment_id).single();

  if (!payment) return json({ paid: false });
  if (payment.status === "approved") return json({ paid: true });

  try {
    const tx = await mpFetch(`/v1/payments/${payment.external_id}`);
    const paid = tx.status === "approved";

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
  } catch {
    return json({ paid: false });
  }
}

// ── Route: Login with email + password ────────────────────────
async function handleLogin(body: Record<string, unknown>) {
  const { email, password, check_only } = body;
  const db = sb();

  if (!email) return json({ error: "Email obrigatorio" }, 400);

  // Check if user exists (need password_hash for verification)
  const { data: existing } = await db
    .from("subscriptions").select("id, email, plan_id, analyses_used, analyses_limit, status, created_at, expires_at, password_hash").eq("email", email)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  // Check-only mode: just return if user exists
  if (check_only) {
    return json({ isNew: !existing });
  }

  if (!password) return json({ error: "Senha obrigatoria" }, 400);

  // Hash password for comparison
  const encoder = new TextEncoder();
  const data = encoder.encode(String(password));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  if (existing) {
    // User exists — verify password
    if (existing.password_hash !== passwordHash) {
      return json({ error: "Senha incorreta" }, 401);
    }
    const { data: payment } = await db
      .from("payments").select(SAFE_PAYMENT_FIELDS).eq("subscription_id", existing.id)
      .eq("status", "pending").limit(1).maybeSingle();
    const { password_hash, ...safeSub } = existing;
    return json({ subscription: safeSub, payment: payment || null, isNew: false });
  }

  // New user — create subscription with password
  const { data: plan } = await db
    .from("subscription_plans").select("*").eq("active", true)
    .limit(1).single();

  const { data: sub, error } = await db
    .from("subscriptions").insert({
      email, plan_id: plan.id, analyses_used: 0,
      analyses_limit: 5, status: "pending",
      password_hash: passwordHash,
    }).select(SAFE_SUB_FIELDS).single();

  if (error) throw error;
  const { password_hash: _, ...safeSub } = sub;
  return json({ subscription: safeSub, payment: null, isNew: true });
}

// ── Route: Get or create subscription ─────────────────────────
async function handleSubscription(body: Record<string, unknown>) {
  const { email } = body;
  const db = sb();

  const { data: existing } = await db
    .from("subscriptions").select(SAFE_SUB_FIELDS).eq("email", email)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (existing) {
    const { data: payment } = await db
      .from("payments").select(SAFE_PAYMENT_FIELDS).eq("subscription_id", existing.id)
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
    }).select(SAFE_SUB_FIELDS).single();

  if (error) throw error;
  return json({ subscription: sub, payment: null });
}

// ── Route: Check subscription ─────────────────────────────────
async function handleCheckSubscription(body: Record<string, unknown>) {
  const { email } = body;
  const db = sb();

  // Check for active (not expired) subscription
  const { data: active } = await db
    .from("subscriptions").select(SAFE_SUB_FIELDS).eq("email", email)
    .eq("status", "active").gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (active) {
    return json({
      allowed: active.analyses_limit - active.analyses_used > 0,
      remaining: active.analyses_limit - active.analyses_used,
      subscription: active,
      expired: false,
    });
  }

  // Check for expired subscription
  const { data: expired } = await db
    .from("subscriptions").select(SAFE_SUB_FIELDS).eq("email", email)
    .eq("status", "active")
    .lte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (expired) {
    return json({
      allowed: false,
      remaining: 0,
      subscription: expired,
      expired: true,
    });
  }

  // Check for pending subscription
  const { data: pending } = await db
    .from("subscriptions").select(SAFE_SUB_FIELDS).eq("email", email)
    .eq("status", "pending")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (pending) {
    return json({
      allowed: false,
      remaining: 0,
      subscription: pending,
      expired: false,
    });
  }

  return json({ allowed: false, remaining: 0, subscription: null, expired: false });
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
      case "login": return await handleLogin(body);
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
