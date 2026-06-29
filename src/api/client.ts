import axios from 'axios';
import { supabase } from '../lib/supabase';
import type { CompanyFormData, BrandPresenceResult } from '../types';
import { mockBrandPresenceResult } from '../mocks/data';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * ── Backend Routes Documentation (Future Implementation) ──────────────
 *
 * POST /api/analysis
 *   Request body: CompanyFormData
 *   Response: BrandPresenceResult
 *   Description: Submits company data and returns brand presence analysis
 *   across LLM platforms.
 *
 * GET /api/analysis/:id
 *   Response: BrandPresenceResult
 *   Description: Retrieves a previously computed analysis by ID.
 *
 * GET /api/segments
 *   Response: string[]
 *   Description: Returns the list of available business segments.
 *
 * POST /api/analysis/export/:id
 *   Response: PDF or CSV file
 *   Description: Exports the analysis result in a downloadable format.
 *
 * ────────────────────────────────────────────────────────────────────────
 */

export async function submitAnalysis(
  data: CompanyFormData
): Promise<BrandPresenceResult> {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return mockBrandPresenceResult;
  }

  // Save company to Supabase
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      company_name: data.companyName,
      website: data.website,
      segment: data.segment,
      location: data.location,
      contact_name: data.contactName,
      email: data.email,
    })
    .select()
    .single();

  if (companyError) throw companyError;

  // Call backend API for analysis
  const response = await api.post<BrandPresenceResult>('/analysis', data);
  const result = response.data;

  // Save analysis to Supabase
  const { data: analysis, error: analysisError } = await supabase
    .from('analyses')
    .insert({
      company_id: company.id,
      overall_score: result.overallScore,
      summary: result.summary,
      recommendations: result.recommendations,
    })
    .select()
    .single();

  if (analysisError) throw analysisError;

  // Save platform mentions
  const mentions = result.brandMentions.map((m) => ({
    analysis_id: analysis.id,
    platform: m.platform,
    score: m.score,
    context: m.context,
    examples: m.examples,
  }));

  const { error: mentionsError } = await supabase
    .from('platform_mentions')
    .insert(mentions);

  if (mentionsError) throw mentionsError;

  return result;
}
