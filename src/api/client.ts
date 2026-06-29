import type { CompanyFormData, BrandPresenceResult } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export async function submitAnalysis(
  data: CompanyFormData
): Promise<BrandPresenceResult> {
  const res = await fetch(`${API_BASE}/api/analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Analysis failed');
  }

  return res.json();
}
