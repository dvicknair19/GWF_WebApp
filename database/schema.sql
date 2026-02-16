-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Vendor Cache Table
CREATE TABLE IF NOT EXISTS vendor_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_name TEXT NOT NULL UNIQUE,
  research_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_name ON vendor_cache(vendor_name);
CREATE INDEX IF NOT EXISTS idx_updated_at ON vendor_cache(updated_at);

-- 2. Profiles Table using Supabase Auth
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  client_name TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  deal_description TEXT,
  research_data JSONB NOT NULL,
  cache_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_created_at ON profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_name_profiles ON profiles(vendor_name);

-- 3. Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see all profiles (as per requirements "all team members can view history")
CREATE POLICY "Enable read access for authenticated users" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Users can insert their own profiles
CREATE POLICY "Enable insert for authenticated users" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Invite-Only Trigger (Disable public signup)
-- This function runs before a user is created. 
-- To allow invites, we can just disable "Enable Signups" in Supabase Dashboard -> Authentication -> Providers -> Email
-- But if we want a trigger to block, here is one:

/*
CREATE OR REPLACE FUNCTION public.check_user_allowed()
RETURNS param from auth.users
LANGUAGE plpgsql
AS $$
BEGIN
  -- Simple logic: Allow if email is in 'allowed_users' table (if we had one)
  -- or just fail by default unless invited.
  -- Supabase handles invites natively, so disabling public signups is better.
  RETURN NEW;
END;
$$;
*/

-- Guide: Go to Authentication -> Settings -> User Signups -> Disable "Allow new users to sign up".
-- Then use "Invite User" from the dashboard.
