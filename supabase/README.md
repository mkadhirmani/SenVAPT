# Sennovate Autonomous VAPT Platform - Supabase Database Guide

This directory contains the database schema, security policies, and maintenance documentation for the **Sennovate Autonomous VAPT Platform**.

---

## 📁 Files in this Directory

| File | Purpose |
| :--- | :--- |
| **`schema.sql`** | **Complete Database Schema**: Contains definitions for `vapt_scans`, `vapt_users`, indexes, RLS policies, realtime replication, and default seed accounts. Run this in Supabase SQL Editor if setting up a new project or verifying tables. |
| **`enable_strict_rls.sql`** | **Security Hardening Script**: Enables strict Row Level Security (RLS) on `public.vapt_users`, revokes all public/anon access, and removes user records from public realtime websockets. |

---

## 🔍 Why Does Supabase Auto-Pause & Need to be Restored?

### 1. The 7-Day Inactivity Pause
Supabase free-tier projects automatically **pause** if they receive no active API traffic or database queries for **7 consecutive days**.
- When paused, PostgreSQL shuts down and returns `503 Service Unavailable`.
- You receive an email asking to click **"Restore project"** in the Supabase Dashboard.
- When clicked, Supabase restores the database from the latest snapshot.

### 2. Why the Supabase SQL Editor Tabs Disappear
- In the Supabase web dashboard, the **SQL Editor** tabs and saved query history are stored in **client-side browser cache / local storage**, NOT inside the PostgreSQL database.
- Whenever a project pauses and restores, or when logging in from another browser or incognito session, the SQL Editor tabs will appear blank.
- **Your database schema was not lost.** The actual tables (`vapt_scans`, `vapt_users`) and data remain intact in PostgreSQL.
- To view or edit the schema anytime, use the version-controlled [`supabase/schema.sql`](file:///Users/Mouna_sk2005/Downloads/Autonomous%20VAPT%20dashboard/supabase/schema.sql) file in this repository.

### 3. Why "No Content in the Table" May Appear in Supabase Table Editor
If the Supabase web dashboard's Table Editor shows no content:
1. **Check the Schema Selector**: Ensure the schema dropdown at the top of the Table Editor is set to **`public`** (not `auth`, `storage`, or `extensions`).
2. **PostgREST Schema Cache Refresh**: Right after unpausing/restoring, Supabase's API cache may take 1-2 minutes to reload. Press `Cmd + Shift + R` (or `Ctrl + F5`) in your browser to hard refresh.
3. **Verify Table Rows**: You can verify table contents directly from the terminal at any time using:
   ```bash
   node scratch/verify_supabase_db.mjs
   ```

---

## 🛡️ Automated Keep-Alive Heartbeat (Prevents Future Pauses)

To guarantee that Supabase **never auto-pauses again**, both `server.js` and `vite.config.js` include an automated **Keep-Alive Heartbeat**:
- The server pings `vapt_scans` via the Supabase REST API every 12 hours.
- This continuous activity registers active traffic with Supabase, preventing the 7-day inactivity trigger from ever pausing the database.

---

## 🚀 How to Run `schema.sql` in Supabase

1. Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/xgbpnwetwawnihfmngmq/sql).
2. Click **New Query**.
3. Copy the entire contents of [`supabase/schema.sql`](file:///Users/Mouna_sk2005/Downloads/Autonomous%20VAPT%20dashboard/supabase/schema.sql) and paste into the editor.
4. Click **Run** (or press `Cmd + Enter` / `Ctrl + Enter`).
5. Confirm the query completes successfully with table counts displayed in the results pane.
