export interface CompanyFormData {
  companyName: string;
  website: string;
  segment: string;
  location: string;
  contactName: string;
  email: string;
}

export interface BrandPresenceResult {
  overallScore: number;
  brandMentions: BrandMention[];
  competitors: Competitor[];
  summary: string;
  recommendations: string[];
}

export interface BrandMention {
  platform: string;
  score: number;
  context: string;
  examples: string[];
}

export interface Competitor {
  name: string;
  score: number;
  context: string;
}

export type SegmentOption =
  | 'Tecnologia'
  | 'Saude'
  | 'Financeiro'
  | 'Educacao'
  | 'Varejo'
  | 'Industria'
  | 'Servicos'
  | 'Outro';
