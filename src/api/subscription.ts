import { supabase } from '../lib/supabase';

export const PLAN_CONFIG = {
  analysesLimit: 5,
  priceCents: 300,
  currency: 'BRL',
  label: '5 analises por R$ 3,00',
};

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
  checkout_url: string | null;
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
  const data = await invoke({
    route: 'pix/create',
    subscription_id: subscriptionId,
    email,
  });

  // Redirect to AbacatePay checkout
  if (data.checkout_url) {
    window.location.href = data.checkout_url;
  }

  return {
    id: data.payment_id,
    subscription_id: subscriptionId,
    external_id: data.checkout_id,
    amount_cents: PLAN_CONFIG.priceCents,
    currency: PLAN_CONFIG.currency,
    status: 'pending',
    checkout_url: data.checkout_url,
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
}> {
  return invoke({ route: 'subscription/check', email });
}

export async function incrementUsage(subscriptionId: string): Promise<void> {
  await invoke({ route: 'subscription/increment', subscription_id: subscriptionId });
}
