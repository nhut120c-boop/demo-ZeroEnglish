-- ═══════════════════════════════════════════════════════════
-- ZeroEnglish — Supabase Database Setup
-- Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Enable pgcrypto (needed for bcrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Users table
CREATE TABLE IF NOT EXISTS public.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  name          text NOT NULL,
  password_hash text NOT NULL,
  plan          text NOT NULL DEFAULT 'classic' CHECK (plan IN ('classic', 'pro')),
  role          text NOT NULL DEFAULT 'user'    CHECK (role IN ('user', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 3. Index for fast email lookup
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

-- 4. Updated_at auto-trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ═══════════════════════════════════════════════════════════
-- 5. RPC: hash_password (bcrypt 12 rounds via pgcrypto)
--    Called by Netlify function server-side ONLY
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hash_password(plain text)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT crypt(plain, gen_salt('bf', 12));
$$;

-- ═══════════════════════════════════════════════════════════
-- 6. RPC: verify_password
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.verify_password(plain text, hash text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT crypt(plain, hash) = hash;
$$;

-- ═══════════════════════════════════════════════════════════
-- 7. Row Level Security (RLS) — Block all direct client access
--    Only service_role key (used by Netlify) can read/write
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- No policies = no client access. Only service_role bypasses RLS.
-- This means the anon/public key CANNOT read this table directly.
-- ═══════════════════════════════════════════════════════════

-- 8. Grant execute on RPC functions to service role only
REVOKE EXECUTE ON FUNCTION public.hash_password(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_password(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_password(text, text) TO service_role;

-- ═══════════════════════════════════════════════════════════
-- DONE. Your database is ready.
-- ═══════════════════════════════════════════════════════════
