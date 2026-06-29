import { supabase } from '../lib/supabase';
import type { CompanyFormData, BrandPresenceResult } from '../types';

export async function submitAnalysis(
  data: CompanyFormData
): Promise<BrandPresenceResult> {
  const { data: result, error } = await supabase.functions.invoke('api', {
    body: { route: 'analysis', ...data },
  });

  if (error) throw new Error(error.message);
  return result;
}
