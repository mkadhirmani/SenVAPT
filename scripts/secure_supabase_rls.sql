-- ==============================================================================
-- Sennovate VAPT - Remediation Script: Secure Supabase RLS & Permissions
-- Run this script directly in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 1. Ensure Row Level Security (RLS) is enabled on all sensitive tables
ALTER TABLE IF EXISTS public.vapt_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vapt_scans ENABLE ROW LEVEL SECURITY;

-- 2. Drop the insecure permissive policies (CWE-639 / BFLA)
DROP POLICY IF EXISTS "Allow public access to vapt_users" ON public.vapt_users;
DROP POLICY IF EXISTS "Allow public access to vapt_scans" ON public.vapt_scans;
DROP POLICY IF EXISTS "Allow public read access to vapt_users" ON public.vapt_users;
DROP POLICY IF EXISTS "Allow public write access to vapt_users" ON public.vapt_users;
DROP POLICY IF EXISTS "Allow public read access to vapt_scans" ON public.vapt_scans;
DROP POLICY IF EXISTS "Allow public write access to vapt_scans" ON public.vapt_scans;

-- 3. Revoke all permissions from the unauthenticated anon key
REVOKE ALL ON TABLE public.vapt_users FROM anon;
REVOKE ALL ON TABLE public.vapt_scans FROM anon;

-- 4. Grant access to authenticated users and backend service_role
GRANT ALL ON TABLE public.vapt_users TO service_role;
GRANT ALL ON TABLE public.vapt_users TO authenticated;

GRANT ALL ON TABLE public.vapt_scans TO service_role;
GRANT ALL ON TABLE public.vapt_scans TO authenticated;

-- 5. Policies for vapt_scans (Authenticated users can read, insert, and update)
DROP POLICY IF EXISTS "Authenticated users can view scans" ON public.vapt_scans;
CREATE POLICY "Authenticated users can view scans"
    ON public.vapt_scans FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert scans" ON public.vapt_scans;
CREATE POLICY "Authenticated users can insert scans"
    ON public.vapt_scans FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update scans" ON public.vapt_scans;
CREATE POLICY "Authenticated users can update scans"
    ON public.vapt_scans FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 6. Upgrade any plain text passwords in vapt_users to strong PBKDF2 hashes
UPDATE public.vapt_users
SET password = 'pbkdf2$167b7fbe26072d2f6f5f5dfd2b9807f1$56902376e2e69baba1775547a4d4b465c8b287b4e1c545e72ed6362e4ea4db437fd2ef5ad2def2ac9901ff38d1017f7082adfcc1464a40deec09ff425a3f792f'
WHERE username = 'admin' AND (password = '@A198vapt' OR password NOT LIKE 'pbkdf2$%');

UPDATE public.vapt_users
SET password = 'pbkdf2$c282e3c0d2947f2f979472296e48196b$f63d10d202acf5f1186c71783c11546785817a3bdc43f5e268fe51b4cb3aab6d531a6b528ea08cd8a213f5c1a6a024a32c518c27b56bf3bbba1c290de8b77e74'
WHERE username = 'user' AND (password = '@user1vapt' OR password NOT LIKE 'pbkdf2$%');

UPDATE public.vapt_users
SET password = 'pbkdf2$45effd9cae68b223528fab9a89b3f221$b94203245ffab85d9e396638543f6c9b3827e1b4dd5b289d2c0ac58fc6cbf3893b5ab82d2aa09e29e50d78b49091bd1afbcb23bbb5737b3e71274178839a5769'
WHERE username = 'sales123' AND (password = '@sales1vapt' OR password NOT LIKE 'pbkdf2$%');

-- 7. Verification query (should return 0 unhashed rows)
SELECT id, username, role, 
       CASE WHEN password LIKE 'pbkdf2$%' THEN 'SECURE (PBKDF2 Hashed)' ELSE 'UNHASHED' END as password_status
FROM public.vapt_users;
