# Supabase Security Hardening & Strict RLS Migration

This directory contains database migration scripts for the **Sennovate Autonomous VAPT Platform**.

## Files
- `enable_strict_rls.sql`: **Execution Script** to enable Row Level Security (RLS) on `public.vapt_users`, revoke all access from `anon` and `public`, and drop `vapt_users` from realtime websocket replication.

## How to Apply
1. Open the Supabase project dashboard:
   **[Supabase SQL Editor](https://supabase.com/dashboard/project/xgbpnwetwawnihfmngmq/sql)**
2. Click **New Query**.
3. Copy the entire contents of `enable_strict_rls.sql` and paste it into the editor.
4. Click **Run** (or press `Cmd + Enter` / `Ctrl + Enter`).
5. Confirm the query finishes successfully.

## Verification
Run the python exploit script:
```python
import requests

supabase_url = "https://xgbpnwetwawnihfmngmq.supabase.co/rest/v1/vapt_users"
anon_key = "sb_publishable_o5ldfHD5y_hoFyp_gSas4Q_BcHPliFI"
headers = {
    "apiKey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Accept": "application/json"
}

r = requests.get(supabase_url, headers=headers)
print("Status:", r.status_code)
print("Response:", r.text)
```
**Expected Result**:
`Status: 401 Unauthorized` or `Status: 403 Forbidden` / `{"message":"permission denied for table vapt_users","code":"42501"}`.
Direct CRUD operations via the anon key are completely blocked.
