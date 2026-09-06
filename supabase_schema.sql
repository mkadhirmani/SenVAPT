-- ==============================================================================
-- Sennovate Autonomous VAPT Dashboard - Supabase Cloud Database Schema
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. Create vapt_users table
CREATE TABLE IF NOT EXISTS public.vapt_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    password TEXT,
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
    created_by TEXT DEFAULT 'user',
    scanned_by TEXT DEFAULT 'user',
    scanned_by_name TEXT DEFAULT 'User',
    user_role TEXT DEFAULT 'User',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create helpful query indexes
CREATE INDEX IF NOT EXISTS idx_vapt_users_username ON public.vapt_users (username);
CREATE INDEX IF NOT EXISTS idx_vapt_scans_created_at ON public.vapt_scans (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vapt_scans_created_by ON public.vapt_scans (created_by);
CREATE INDEX IF NOT EXISTS idx_vapt_scans_target_url ON public.vapt_scans (target_url);

-- 3. Enable Row Level Security (RLS) & Public Access Policies
ALTER TABLE public.vapt_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vapt_scans ENABLE ROW LEVEL SECURITY;

-- Allow read & write access for application users (or anon key)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vapt_users' AND policyname = 'Allow public access to vapt_users') THEN
        CREATE POLICY "Allow public access to vapt_users" ON public.vapt_users FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vapt_scans' AND policyname = 'Allow public access to vapt_scans') THEN
        CREATE POLICY "Allow public access to vapt_scans" ON public.vapt_scans FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Enable Realtime Replication for instant multi-user synchronization
ALTER PUBLICATION supabase_realtime ADD TABLE public.vapt_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vapt_scans;

-- 5. Seed default accounts if not already present
INSERT INTO public.vapt_users (id, username, email, password, name, role, title, permissions)
VALUES 
    ('admin', 'admin', 'admin@sennovate.com', '@A198vapt', 'Administrator', 'admin', 'Root Administrator', '{"run_scans":true,"view_findings":true,"attack_graph":true,"ai_assistant":true,"export_reports":true,"view_tokens":true,"view_terminal":true,"manage_settings":true,"manage_users":true,"load_custom_folder":true}'::jsonb),
    ('user', 'user', 'user@sennovate.com', '@user1vapt', 'User', 'user', 'Security Analyst', '{"run_scans":true,"view_findings":true,"attack_graph":true,"ai_assistant":true,"export_reports":true,"view_tokens":false,"view_terminal":false,"manage_settings":false,"manage_users":false,"load_custom_folder":false}'::jsonb),
    ('sales123', 'sales123', 'sales@sennovate.com', '@sales1vapt', 'Sales Team', 'sales', 'Sales & BD Specialist', '{"run_scans":true,"view_findings":true,"attack_graph":true,"ai_assistant":true,"export_reports":true,"view_tokens":true,"view_terminal":false,"manage_settings":false,"manage_users":false,"load_custom_folder":false}'::jsonb)
ON CONFLICT (username) DO NOTHING;
