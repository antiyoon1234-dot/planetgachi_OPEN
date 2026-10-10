-- Market pricing settings. Run this after the existing auction_schema.sql migration.
CREATE TABLE IF NOT EXISTS public.auction_price_rules (
  item_type text PRIMARY KEY,
  price_cap bigint CHECK (price_cap IS NULL OR price_cap >= 0),
  include_anomalies boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.market_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.auction_market_prices (
  item_key text PRIMARY KEY,
  item_type text NOT NULL,
  display_name text NOT NULL,
  auction_average_price bigint,
  display_price bigint,
  transaction_count integer NOT NULL DEFAULT 0,
  excluded_anomaly_count integer NOT NULL DEFAULT 0,
  price_cap bigint,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auction_anomalies
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'included', 'excluded')),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS auction_transactions_type_date_idx
  ON public.auction_transactions (item_type, transaction_date DESC);
CREATE INDEX IF NOT EXISTS auction_anomalies_status_date_idx
  ON public.auction_anomalies (review_status, transaction_date DESC);

-- The frontend must be read-only. Give UPDATE/INSERT permissions only to a
-- server-side Edge Function that uses the service role, never to anon users.
ALTER TABLE public.auction_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_price_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_market_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public reads auction transactions" ON public.auction_transactions;
CREATE POLICY "public reads auction transactions" ON public.auction_transactions
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "public reads market prices" ON public.auction_market_prices;
CREATE POLICY "public reads market prices" ON public.auction_market_prices
  FOR SELECT USING (true);

-- Replace the placeholder claim below with the actual Supabase Auth role claim.
-- Only signed-in admins may edit display rules and market settings.
DROP POLICY IF EXISTS "admins manage price rules" ON public.auction_price_rules;
CREATE POLICY "admins manage price rules" ON public.auction_price_rules
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
DROP POLICY IF EXISTS "admins manage market settings" ON public.market_settings;
CREATE POLICY "admins manage market settings" ON public.market_settings
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
DROP POLICY IF EXISTS "admins review auction anomalies" ON public.auction_anomalies;
CREATE POLICY "admins review auction anomalies" ON public.auction_anomalies
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

INSERT INTO public.market_settings (setting_key, setting_value)
VALUES
  ('pricing', '{"anomalyRate":50,"minimumSamples":5}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
