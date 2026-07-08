-- =============================================================
-- Geome - Supabase Schema
-- =============================================================

-- Companies table: stores form submissions
CREATE TABLE companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  website TEXT NOT NULL,
  segment TEXT NOT NULL,
  location TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Analysis results table: stores brand presence analysis per company
CREATE TABLE analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  overall_score INT NOT NULL,
  summary TEXT NOT NULL,
  recommendations TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Platform mentions table: per-platform breakdown within each analysis
CREATE TABLE platform_mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  score INT NOT NULL,
  context TEXT NOT NULL,
  examples TEXT[] NOT NULL
);

-- =============================================================
-- Subscriptions & Payments (Banco Inter PIX)
-- =============================================================

-- Subscription plans
CREATE TABLE subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  analyses_limit INT NOT NULL,
  price_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default plan: 6 analyses per R$ 12.00
INSERT INTO subscription_plans (name, analyses_limit, price_cents, currency)
VALUES ('Plano Basico', 6, 1200, 'BRL');

-- Subscriptions: tracks user's active plan and usage
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  analyses_used INT DEFAULT 0,
  analyses_limit INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  pix_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- PIX payments via Banco Inter
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  external_id TEXT,
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  pix_copy_paste TEXT,
  pix_qr_code TEXT,
  bank_code TEXT NOT NULL DEFAULT '077',
  agency TEXT NOT NULL DEFAULT '0001-9',
  account_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_companies_created_at ON companies(created_at DESC);
CREATE INDEX idx_analyses_company_id ON analyses(company_id);
CREATE INDEX idx_platform_mentions_analysis_id ON platform_mentions(analysis_id);
CREATE INDEX idx_subscriptions_email ON subscriptions(email);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Row Level Security (RLS)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public form submissions)
CREATE POLICY "Allow anonymous inserts on companies"
  ON companies FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts on analyses"
  ON analyses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts on platform_mentions"
  ON platform_mentions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow read plans"
  ON subscription_plans FOR SELECT
  USING (true);

CREATE POLICY "Allow anonymous inserts on subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow read own subscriptions"
  ON subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Allow update own subscriptions"
  ON subscriptions FOR UPDATE
  USING (true);

CREATE POLICY "Allow anonymous inserts on payments"
  ON payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow read own payments"
  ON payments FOR SELECT
  USING (true);

CREATE POLICY "Allow update payments"
  ON payments FOR UPDATE
  USING (true);
