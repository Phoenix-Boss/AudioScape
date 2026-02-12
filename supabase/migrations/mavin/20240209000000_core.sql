-- File: 20240209000000_core.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Premium users table
CREATE TABLE IF NOT EXISTS premium_users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  device_fingerprint TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  subscription_tier TEXT DEFAULT 'pro' CHECK (subscription_tier IN ('free', 'pro', 'premium')),
  trial_ends_at BIGINT,
  subscription_ends_at BIGINT,
  card_token TEXT, -- Encrypted Stripe/Paystack token
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  
  -- Index for fast lookups
  INDEX idx_premium_users_fingerprint (device_fingerprint),
  INDEX idx_premium_users_active (is_active),
  INDEX idx_premium_users_trial_ends (trial_ends_at)
);

-- RPC function to check premium status
CREATE OR REPLACE FUNCTION check_premium_status(p_device_fingerprint TEXT)
RETURNS TABLE (
  is_active BOOLEAN,
  subscription_tier TEXT,
  trial_ends_at BIGINT,
  subscription_ends_at BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pu.is_active,
    pu.subscription_tier,
    pu.trial_ends_at,
    pu.subscription_ends_at
  FROM premium_users pu
  WHERE pu.device_fingerprint = p_device_fingerprint
    AND pu.is_active = true
    AND (pu.trial_ends_at IS NULL OR pu.trial_ends_at > EXTRACT(EPOCH FROM NOW()) * 1000)
    AND (pu.subscription_ends_at IS NULL OR pu.subscription_ends_at > EXTRACT(EPOCH FROM NOW()) * 1000)
  LIMIT 1;
END;
$$;

-- Row level security
ALTER TABLE premium_users ENABLE ROW LEVEL SECURITY;

-- Policy for inserts (users can create their own premium record)
CREATE POLICY "Users can insert their own premium record" ON premium_users
  FOR INSERT WITH CHECK (true);

-- Policy for selects (users can only see their own data)
CREATE POLICY "Users can view their own premium data" ON premium_users
  FOR SELECT USING (device_fingerprint = current_setting('app.current_device_fingerprint', true));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = EXTRACT(EPOCH FROM NOW()) * 1000;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_premium_users_updated_at BEFORE UPDATE
  ON premium_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();