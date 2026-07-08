-- Clean up all data and update plan
-- Run this in Supabase Dashboard > SQL Editor

-- Truncate all data (keeps table structure)
TRUNCATE TABLE platform_mentions CASCADE;
TRUNCATE TABLE analyses CASCADE;
TRUNCATE TABLE companies CASCADE;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE subscriptions CASCADE;

-- Update the default plan
UPDATE subscription_plans 
SET analyses_limit = 6, price_cents = 1200 
WHERE name = 'Plano Basico';

-- If no plan exists, insert one
INSERT INTO subscription_plans (name, analyses_limit, price_cents, currency)
SELECT 'Plano Basico', 6, 1200, 'BRL'
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Plano Basico');
