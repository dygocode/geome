const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

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
  pix_copy_paste: string | null;
  pix_qr_code: string | null;
  bank_code: string;
  agency: string;
  created_at: string;
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API error');
  }
  return res.json();
}

export async function getOrCreateSubscription(
  email: string
): Promise<{ subscription: Subscription; payment?: Payment }> {
  return apiPost('/api/subscription', { email });
}

export async function generatePayment(
  subscriptionId: string,
  email: string
): Promise<Payment> {
  const data = await apiPost<{
    payment_id: string;
    pix_copy_paste: string;
    pix_qr_code: string;
    txid: string;
  }>('/api/pix/create', {
    subscription_id: subscriptionId,
    email,
    amount_cents: PLAN_CONFIG.priceCents,
  });

  return {
    id: data.payment_id,
    subscription_id: subscriptionId,
    external_id: data.txid,
    amount_cents: PLAN_CONFIG.priceCents,
    currency: PLAN_CONFIG.currency,
    status: 'pending',
    pix_copy_paste: data.pix_copy_paste,
    pix_qr_code: data.pix_qr_code,
    bank_code: '077',
    agency: '0001-9',
    created_at: new Date().toISOString(),
  };
}

export async function checkAndActivatePayment(
  paymentId: string
): Promise<{ activated: boolean; subscription: Subscription | null }> {
  const data = await apiPost<{ paid: boolean }>('/api/pix/check', {
    payment_id: paymentId,
  });

  if (!data.paid) return { activated: false, subscription: null };

  // Payment confirmed — fetch updated subscription
  const subData = await apiPost<{ subscription: Subscription }>('/api/subscription/check', {
    email: sessionStorage.getItem('analysisEmail') || '',
  });

  return { activated: true, subscription: subData.subscription };
}

export async function canUseAnalysis(email: string): Promise<{
  allowed: boolean;
  remaining: number;
  subscription: Subscription | null;
}> {
  return apiPost('/api/subscription/check', { email });
}

export async function incrementUsage(subscriptionId: string): Promise<void> {
  await apiPost('/api/subscription/increment', { subscription_id: subscriptionId });
}
