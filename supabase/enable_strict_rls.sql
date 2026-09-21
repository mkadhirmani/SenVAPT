-- ==============================================================================
-- SENNOVATE VAPT SECURITY REMEDIATION: STRICT RLS ON vapt_users
-- Complete Target: https://senvapt.sennovate.ai (Project: xgbpnwetwawnihfmngmq)
--
-- Instructions:
-- 1. Open Supabase Dashboard -> SQL Editor (https://supabase.com/dashboard/project/xgbpnwetwawnihfmngmq/sql)
-- 2. Paste and run this script.
-- 3. Verify that the output shows RLS enabled and privileges revoked from anon/public.
-- ==============================================================================

BEGIN;

-- 1. Enable and FORCE Row Level Security on vapt_users
ALTER TABLE IF EXISTS public.vapt_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vapt_users FORCE ROW LEVEL SECURITY;

-- 2. Drop all legacy permissive and public policies on vapt_users
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'vapt_users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.vapt_users;', pol.policyname);
    END LOOP;
END $$;

-- 3. Explicitly REVOKE ALL permissions on vapt_users from anon, authenticated, and public roles
REVOKE ALL PRIVILEGES ON TABLE public.vapt_users FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.vapt_users FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.vapt_users FROM public;

-- Revoke default column privileges as well
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- 4. GRANT full administrative access EXCLUSIVELY to service_role and postgres
GRANT ALL PRIVILEGES ON TABLE public.vapt_users TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.vapt_users TO postgres;

-- 5. Create explicit RESTRICTIVE policies ensuring zero access for anon and public
-- Service role has BYPASSRLS in Supabase, so it is unaffected.
CREATE POLICY "vapt_users_deny_anon_all"
    ON public.vapt_users
    AS RESTRICTIVE
    FOR ALL
    TO anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "vapt_users_deny_public_all"
    ON public.vapt_users
    AS RESTRICTIVE
    FOR ALL
    TO public
    USING (false)
    WITH CHECK (false);

-- Permissive policy strictly for service_role
CREATE POLICY "vapt_users_allow_service_role"
    ON public.vapt_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. Remove vapt_users from Realtime Replication publication
-- This prevents password hashes and user records from leaking over Supabase Realtime WebSockets
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'vapt_users'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.vapt_users;
    END IF;
END $$;

COMMIT;

-- 7. Audit & Verification Output
SELECT 
    schemaname, 
    tablename, 
    rowsecurity AS rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'vapt_users';

SELECT 
    policyname, 
    roles, 
    cmd, 
    permissive 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'vapt_users';

SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'vapt_users';
