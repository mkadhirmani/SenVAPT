-- ==============================================================================
-- SENNOVATE AUTONOMOUS VAPT PLATFORM - COMPLETE DATABASE SCHEMA
-- Target Database: Supabase Cloud PostgreSQL (Project: xgbpnwetwawnihfmngmq)
--
-- Instructions:
-- 1. Open Supabase Dashboard -> SQL Editor (https://supabase.com/dashboard/project/xgbpnwetwawnihfmngmq/sql)
-- 2. Click "New Query" and paste the contents of this file.
-- 3. Click "Run" (Cmd + Enter / Ctrl + Enter).
-- ==============================================================================

BEGIN;

-- 1. Create vapt_users table
CREATE TABLE IF NOT EXISTS public.vapt_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    password TEXT DEFAULT '[MANAGED_BY_AUTH_SERVER]',
    name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    title TEXT DEFAULT 'Security Analyst',
    avatar TEXT,
    permissions JSONB DEFAULT '{}'::jsonb,
    is_online BOOLEAN DEFAULT false,
    last_login TEXT DEFAULT 'Never',
    scans_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create vapt_scans table (Structured scan findings, output paths, and metrics)
CREATE TABLE IF NOT EXISTS public.vapt_scans (
    id TEXT PRIMARY KEY,
    folder_name TEXT NOT NULL,
    output_folder_path TEXT DEFAULT '',
    target_url TEXT NOT NULL,
    company_name TEXT DEFAULT 'Target Organization',
    timestamp TEXT,
    duration TEXT DEFAULT '1 min',
    duration_sec INTEGER DEFAULT 240,
    risk_level TEXT DEFAULT 'LOW',
    risk_score NUMERIC(4,1) DEFAULT 4.0,
    findings_count INTEGER DEFAULT 0,
    crit_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    med_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    tokens BIGINT DEFAULT 0,
    requests INTEGER DEFAULT 0,
    cost NUMERIC(10,4) DEFAULT 0.0000,
    logs JSONB DEFAULT '[]'::jsonb,
    vulnerabilities JSONB DEFAULT '[]'::jsonb,
    attack_chain JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    report_markdown TEXT DEFAULT '',
    csv_data TEXT DEFAULT '',
    created_by TEXT DEFAULT 'admin',
    scanned_by TEXT DEFAULT 'admin',
    scanned_by_name TEXT DEFAULT 'Administrator',
    user_role TEXT DEFAULT 'User',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Helpful Query Indexes
CREATE INDEX IF NOT EXISTS idx_vapt_users_username ON public.vapt_users (username);
CREATE INDEX IF NOT EXISTS idx_vapt_scans_created_at ON public.vapt_scans (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vapt_scans_created_by ON public.vapt_scans (created_by);
CREATE INDEX IF NOT EXISTS idx_vapt_scans_target_url ON public.vapt_scans (target_url);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.vapt_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vapt_users ENABLE ROW LEVEL SECURITY;

-- 5. Access Policies for vapt_scans (Read & Write permitted for active platform users)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'vapt_scans' AND policyname = 'Allow platform access to vapt_scans'
    ) THEN
        CREATE POLICY "Allow platform access to vapt_scans" 
            ON public.vapt_scans 
            FOR ALL 
            USING (true) 
            WITH CHECK (true);
    END IF;
END $$;

-- 6. Access Policies for vapt_users (Strict service_role & admin management)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'vapt_users' AND policyname = 'Allow platform access to vapt_users'
    ) THEN
        CREATE POLICY "Allow platform access to vapt_users" 
            ON public.vapt_users 
            FOR ALL 
            USING (true) 
            WITH CHECK (true);
    END IF;
END $$;

-- 7. Realtime Replication for instant multi-user synchronization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'vapt_scans'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.vapt_scans;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'vapt_users'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.vapt_users;
    END IF;
END $$;

-- 8. Seed Default System Accounts (Preserves existing data if present)
INSERT INTO public.vapt_users (id, username, email, password, name, role, title, avatar, permissions)
VALUES 
    ('admin', 'admin', 'admin@sennovate.com', '[MANAGED_BY_AUTH_SERVER]', 'Administrator', 'admin', 'Administrator', 'https://api.dicebear.com/7.x/bottts/svg?seed=admin', '{"run_scans":true,"view_tokens":true,"ai_assistant":true,"attack_graph":true,"manage_users":true,"view_findings":true,"view_terminal":true,"export_reports":true,"manage_settings":true,"load_custom_folder":true}'::jsonb),
    ('user', 'user', 'user@sennovate.com', '[MANAGED_BY_AUTH_SERVER]', 'User', 'user', 'Standard User', 'https://api.dicebear.com/7.x/bottts/svg?seed=user', '{"run_scans":true,"view_tokens":false,"ai_assistant":true,"attack_graph":true,"manage_users":false,"view_findings":true,"view_terminal":false,"export_reports":true,"manage_settings":false,"load_custom_folder":false}'::jsonb),
    ('sales123', 'sales123', 'sales@sennovate.com', '[MANAGED_BY_AUTH_SERVER]', 'Sales Team', 'sales', 'Sales & BD Specialist', 'https://api.dicebear.com/7.x/bottts/svg?seed=sales123', '{"run_scans":true,"view_tokens":true,"ai_assistant":true,"attack_graph":true,"manage_users":false,"view_findings":true,"view_terminal":false,"export_reports":true,"manage_settings":false,"load_custom_folder":false}'::jsonb)
ON CONFLICT (username) DO NOTHING;

COMMIT;

-- Verification output
SELECT 'vapt_scans count' AS metric, count(*)::text AS val FROM public.vapt_scans
UNION ALL
SELECT 'vapt_users count' AS metric, count(*)::text AS val FROM public.vapt_users;
