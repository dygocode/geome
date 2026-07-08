import { supabase } from '../lib/supabase';

export interface PlanConfig {
  id: string;
  name: string;
  analysesLimit: number;
  priceCents: number;
  currency: string;
}

let cachedPlan: PlanConfig | null = null;

export async function getPlanConfig(): Promise<PlanConfig> {
  if (cachedPlan) return cachedPlan;

  const { data, error } = await supabase.functions.invoke('api', {
    body: { route: 'plan/get' },
  });

  if (error) throw new Error(error.message);

  cachedPlan = {
    id: data.id,
    name: data.name,
    analysesLimit: data.analyses_limit,
    priceCents: data.price_cents,
    currency: data.currency,
  };

  return cachedPlan;
}

export interface Subscription {
  id: string;
  email: string;
  plan_id: string;
  analyses_used: number;
  analyses_limit: number;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  created_at: string;
  expires_at: string | null;
}

export interface Payment {
  id: string;
  subscription_id: string;
  external_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  pix_copy_paste: string | null;
  pix_qr_code: string | null;
  ticket_url: string | null;
  created_at: string;
}

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('api', { body });
  if (error) throw new Error(error.message);
  return data;
}

export async function getOrCreateSubscription(
  email: string
): Promise<{ subscription: Subscription; payment?: Payment }> {
  return invoke({ route: 'subscription', email });
}

export async function generatePayment(
  subscriptionId: string,
  email: string
): Promise<Payment> {
  const plan = await getPlanConfig();
  const data = await invoke({
    route: 'pix/create',
    subscription_id: subscriptionId,
    email,
  });

  return {
    id: data.payment_id,
    subscription_id: subscriptionId,
    external_id: String(data.transaction_id),
    amount_cents: plan.priceCents,
    currency: plan.currency,
    status: 'pending',
    pix_copy_paste: data.pix_copy_paste,
    pix_qr_code: data.qr_code_base64,
    ticket_url: data.ticket_url,
    created_at: new Date().toISOString(),
  };
}

export async function checkAndActivatePayment(
  paymentId: string
): Promise<{ activated: boolean; subscription: Subscription | null }> {
  const data = await invoke({ route: 'pix/check', payment_id: paymentId });
  if (!data.paid) return { activated: false, subscription: null };

  const subData = await invoke({
    route: 'subscription/check',
    email: sessionStorage.getItem('analysisEmail') || '',
  });
  return { activated: true, subscription: subData.subscription };
}

export async function canUseAnalysis(email: string): Promise<{
  allowed: boolean;
  remaining: number;
  subscription: Subscription | null;
  expired: boolean;
}> {
  return invoke({ route: 'subscription/check', email });
}

export async function incrementUsage(subscriptionId: string): Promise<void> {
  await invoke({ route: 'subscription/increment', subscription_id: subscriptionId });
}

export async function renewSubscription(subscriptionId: string): Promise<{ ok: boolean; expires_at: string }> {
  return invoke({ route: 'subscription/renew', subscription_id: subscriptionId });
}
