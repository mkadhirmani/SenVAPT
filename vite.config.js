import './src/server/loadEnv.js';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import { 
  testSshConnection, 
  startRemoteStrixScan, 
  stopRemoteStrixScan,
  getScanSession, 
  sendInputToScanSession,
  fetchRemoteStrixResults,
  fetchAllRemoteScanRuns,
  parseLocalStrixFolder,
  resolveLocalScanPath,
  listLocalScanFolders,
  triggerN8nScanProxy,
  fetchN8nScanResultsProxy,
  uploadScanZipProxy,
  testN8nFetchWebhookProxy,
  fetchServerFileProxy,
  getGlobalServerConfig,
  getSanitizedServerConfig,
  saveGlobalServerConfig,
  checkAndSyncScanCompletion,
  autoPersistScanToSupabase
} from './src/server/strixBackend.js';
import { 
  supabase, 
  formatUserFromSupabase, 
  formatUserForSupabase,
  formatScanForSupabase,
  getActiveSupabaseConfig
} from './src/utils/supabaseClient.js';
import path from 'path';
import fs from 'fs';

// Automatically load environment variables from .env and .env.local
function loadEnvVariables() {
  const envFiles = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.resolve('.env')
  ];
  for (const envFile of envFiles) {
    try {
      if (fs.existsSync(envFile)) {
        const content = fs.readFileSync(envFile, 'utf-8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if ((process.env[key] === undefined || process.env[key] === '') && val !== undefined && val !== '') {
              process.env[key] = val;
            }
          }
        }
      }
    } catch (_) {}
  }
}
loadEnvVariables();

// Built-in Strix Backend & LLM Proxy Server Plugin
function strixBackendPlugin() {
  // In-Memory Cryptographic Session Registry
  const activeSessions = new Map(); // token -> { user, role, token, expiresAt }

  const createSession = (user) => {
    const token = crypto.randomBytes(32).toString('hex');
    const session = {
      token,
      user,
      role: user.role,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };
    activeSessions.set(token, session);
    return token;
  };

  const getAuthenticatedSession = (req) => {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : (req.headers['x-auth-token'] || req.headers['X-Auth-Token'] || '');
    
    if (!token) {
      return null;
    }

    const session = activeSessions.get(token);
    if (session) {
      if (session.expiresAt && Date.now() > session.expiresAt) {
        activeSessions.delete(token);
        return null;
      }
      return session;
    }

    return null;
  };

  return {
    name: 'strix-backend-middleware',
    configureServer(server) {
      // 1. LLM Proxy Route (Requires Valid Session)
      server.middlewares.use('/api/llm-proxy', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.statusCode = 200;
          return res.end();
        }

        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ error: 'Unauthorized: Authentication required.' }));
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { targetUrl, headers, data } = JSON.parse(body);
            const fetchRes = await fetch(targetUrl, {
              method: 'POST',
              headers: headers || { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });

            const status = fetchRes.status;
            const resText = await fetchRes.text();
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = status;
            res.end(resText);
          } catch (err) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });

      // 1.5. Server Scan History Get & Save Routes (Persisted in .scans_cache.json)
      const SCANS_CACHE_FILE = path.resolve(process.cwd(), '.scans_cache.json');

      const getServerScanHistory = () => {
        try {
          if (fs.existsSync(SCANS_CACHE_FILE)) {
            const data = JSON.parse(fs.readFileSync(SCANS_CACHE_FILE, 'utf-8'));
            if (Array.isArray(data) && data.length > 0) return data;
            if (data && Array.isArray(data.scans) && data.scans.length > 0) return data.scans;
          }
        } catch (e) {}
        return [];
      };

      const saveServerScanHistory = (scans) => {
        try {
          fs.writeFileSync(SCANS_CACHE_FILE, JSON.stringify(scans, null, 2), 'utf-8');
          return true;
        } catch (e) {
          return false;
        }
      };

      server.middlewares.use('/api/scans/get-history', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, scans: getServerScanHistory() }));
      });

      server.middlewares.use('/api/scans/save-history', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            const scansList = Array.isArray(payload) ? payload : (payload.scans || []);
            const ok = saveServerScanHistory(scansList);
            try {
              const supaScans = scansList.map(formatScanForSupabase).filter(Boolean);
              if (supaScans.length > 0) {
                supabase.from('vapt_scans').upsert(supaScans, { onConflict: 'id' }).then(() => {}, () => {});
              }
            } catch (_) {}
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = ok ? 200 : 500;
            res.end(JSON.stringify({ success: ok, count: scansList.length }));
          } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });

      // 2. Global Strix Config Get & Save Routes (Admin Only & Redacted)
      server.middlewares.use('/api/strix/get-config', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session || session.role !== 'admin') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          return res.end(JSON.stringify({ success: false, error: 'Access Denied: Administrator privilege required.' }));
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, config: getSanitizedServerConfig() }));
      });

      server.middlewares.use('/api/strix/save-config', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session || session.role !== 'admin') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          return res.end(JSON.stringify({ success: false, error: 'Access Denied: Administrator privilege required.' }));
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const newConf = JSON.parse(body || '{}');
            const saved = saveGlobalServerConfig(newConf);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, config: getSanitizedServerConfig() }));
          } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });

      // 3. Global LLM Config Get & Save Routes (Persisted in .llm_config.json)
      const LLM_CONFIG_FILE = path.resolve(process.cwd(), '.llm_config.json');

      const getGlobalLlmConfig = () => {
        try {
          if (fs.existsSync(LLM_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(LLM_CONFIG_FILE, 'utf-8'));
          }
        } catch (e) {}
        return null;
      };

      const getSanitizedLlmConfig = () => {
        const conf = getGlobalLlmConfig();
        if (!conf) return null;
        const sanitized = { ...conf };
        const hasApiKey = Boolean(sanitized.apiKey && sanitized.apiKey.length > 0);
        sanitized.apiKey = '';
        return {
          ...sanitized,
          hasApiKey
        };
      };

      const saveGlobalLlmConfig = (conf) => {
        try {
          fs.writeFileSync(LLM_CONFIG_FILE, JSON.stringify(conf, null, 2), 'utf-8');
        } catch (e) {}
      };

      server.middlewares.use('/api/llm/get-config', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session || session.role !== 'admin') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          return res.end(JSON.stringify({ success: false, error: 'Access Denied: Administrator privilege required.' }));
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, config: getSanitizedLlmConfig() }));
      });

      server.middlewares.use('/api/llm/save-config', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session || session.role !== 'admin') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          return res.end(JSON.stringify({ success: false, error: 'Access Denied: Administrator privilege required.' }));
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const conf = JSON.parse(body || '{}');
            saveGlobalLlmConfig(conf);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, config: getSanitizedLlmConfig() }));
          } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });

      // 3.5 Global Users Store & Authentication (Persisted in .users_store.json)
      const USERS_STORE_FILE = path.resolve(process.cwd(), '.users_store.json');

      function hashPassword(password) {
        if (!password) return '';
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
        return `pbkdf2$${salt}$${hash}`;
      }

      function verifyPassword(password, stored) {
        if (!password || !stored) return false;
        if (typeof stored !== 'string') return false;
        if (stored.startsWith('pbkdf2$')) {
          const parts = stored.split('$');
          if (parts.length === 3) {
            const salt = parts[1];
            const targetHash = parts[2];
            try {
              const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
              return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(targetHash, 'hex'));
            } catch (_) {
              return false;
            }
          }
        }
        return (password === stored) || (password.toLowerCase() === stored.toLowerCase());
      }

      function constantTimeCompare(a, b) {
        if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
        const bufA = Buffer.from(a, 'utf-8');
        const bufB = Buffer.from(b, 'utf-8');
        if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
          return true;
        }
        return false;
      }

      const getDefaultUsersSeed = () => [
        {
          id: 'admin',
          username: 'admin',
          email: 'admin@sennovate.com',
          password: process.env.ADMIN_PASSWORD ? (process.env.ADMIN_PASSWORD.startsWith('pbkdf2$') ? process.env.ADMIN_PASSWORD : hashPassword(process.env.ADMIN_PASSWORD)) : '',
          altPassword: '',
          name: 'Administrator',
          role: 'admin',
          title: 'Administrator',
          createdAt: '2026-08-01 08:00:00',
          lastLogin: new Date().toISOString().replace('T', ' ').slice(0, 19),
          isOnline: true,
          scansCount: 0,
          permissions: {
            run_scans: true,
            view_findings: true,
            attack_graph: true,
            ai_assistant: true,
            export_reports: true,
            view_tokens: true,
            view_terminal: true,
            manage_settings: true,
            manage_users: true,
            load_custom_folder: true,
          }
        },
        {
          id: 'user',
          username: 'user',
          email: 'user@sennovate.com',
          password: process.env.USER_PASSWORD || '@user1vapt',
          altPassword: '',
          name: 'User',
          role: 'user',
          title: 'Standard User',
          createdAt: '2026-08-10 09:30:00',
          lastLogin: new Date().toISOString().replace('T', ' ').slice(0, 19),
          isOnline: true,
          scansCount: 0,
          assignedTargets: ['General Compliance & Security Audit'],
          permissions: {
            run_scans: true,
            view_findings: true,
            attack_graph: true,
            ai_assistant: true,
            export_reports: true,
            view_tokens: false,
            view_terminal: false,
            manage_settings: false,
            manage_users: false,
            load_custom_folder: false
          }
        },
        {
          id: 'sales123',
          username: 'sales123',
          email: 'sales@sennovate.com',
          password: process.env.SALES_PASSWORD || '@sales1vapt',
          altPassword: '',
          name: 'Sales Team',
          role: 'sales',
          title: 'Sales & BD Specialist',
          createdAt: '2026-08-27 10:00:00',
          lastLogin: new Date().toISOString().replace('T', ' ').slice(0, 19),
          isOnline: true,
          scansCount: 0,
          assignedTargets: ['Commercial Demos & Sales Audits'],
          permissions: {
            run_scans: true,
            view_findings: true,
            attack_graph: true,
            ai_assistant: true,
            export_reports: true,
            view_tokens: true,
            view_terminal: false,
            manage_settings: false,
            manage_users: false,
            load_custom_folder: false
          }
        }
      ];

      const getGlobalUsersRaw = () => {
        const defaults = getDefaultUsersSeed();
        try {
          if (fs.existsSync(USERS_STORE_FILE)) {
            const data = JSON.parse(fs.readFileSync(USERS_STORE_FILE, 'utf-8'));
            const list = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
            if (list.length > 0) {
              const merged = defaults.map(defUser => {
                const match = list.find(u => u.id === defUser.id || u.username?.toLowerCase() === defUser.username?.toLowerCase());
                if (!match) return defUser;
                return {
                  ...defUser,
                  ...match,
                  password: match.password || defUser.password || '',
                  altPassword: ''
                };
              });
              for (const u of list) {
                if (!merged.some(m => m.id === u.id || m.username?.toLowerCase() === u.username?.toLowerCase())) {
                  merged.push({ ...u });
                }
              }
              return merged;
            }
          }
        } catch (e) {}

        try { fs.writeFileSync(USERS_STORE_FILE, JSON.stringify(defaults, null, 2), 'utf-8'); } catch (_) {}
        return defaults;
      };

      const getSanitizedUsers = () => {
        const users = getGlobalUsersRaw();
        return users.map(u => {
          const sanitized = { ...u };
          delete sanitized.password;
          delete sanitized.altPassword;
          delete sanitized.passwordHash;
          return sanitized;
        });
      };

      const saveGlobalUsers = (users) => {
        try {
          const existingRaw = getGlobalUsersRaw();
          const merged = users.map(u => {
            const match = existingRaw.find(e => e.id === u.id || e.username === u.username);
            return {
              ...u,
              password: u.password || match?.password || ''
            };
          });
          fs.writeFileSync(USERS_STORE_FILE, JSON.stringify(merged, null, 2), 'utf-8');
        } catch (e) {}
      };

      // 3.6 Supabase Configuration (Protected - Requires Active Authenticated Session)
      server.middlewares.use('/api/supabase/config', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Active session required.' }));
        }
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        const { url, key } = getActiveSupabaseConfig();
        res.end(JSON.stringify({ success: true, url, key }));
      });

      // 3.65 Supabase Runtime Config Initializer (Admin Only)
      server.middlewares.use('/api/supabase/init-config', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session || session.role !== 'admin') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          return res.end(JSON.stringify({ success: false, error: 'Access Denied: Administrator privilege required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { url, key } = JSON.parse(body || '{}');
            const cleanUrl = (url || '').trim();
            const cleanKey = (key || '').trim();

            if (!cleanUrl.startsWith('https://') || !cleanUrl.includes('.supabase.co')) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: 'Invalid Supabase Project URL' }));
            }

            if (!cleanKey || cleanKey.length < 20) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: 'Invalid Supabase Key' }));
            }

            process.env.SUPABASE_URL = cleanUrl;
            process.env.VITE_SUPABASE_URL = cleanUrl;
            process.env.SUPABASE_ANON_KEY = cleanKey;
            process.env.VITE_SUPABASE_ANON_KEY = cleanKey;

            const confPath = path.resolve('.supabase_config.json');
            try {
              fs.writeFileSync(confPath, JSON.stringify({ url: cleanUrl, key: cleanKey }, null, 2), 'utf-8');
            } catch (_) {}

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, message: 'Supabase connected', url: cleanUrl }));
          } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });

      // 3.66 Supabase Scan Persistence Proxy Middleware (Authenticated)
      server.middlewares.use('/api/supabase/save-scan', async (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Active authenticated session required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const result = await autoPersistScanToSupabase(payload);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, result }));
          } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });

      // Failed login attempts tracker for rate-limiting brute force attacks
      const failedLoginAttempts = new Map();
      const getRateLimitKey = (req, username) => {
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
        return `${ip}:${username}`;
      };
      const isLoginRateLimited = (key) => {
        const record = failedLoginAttempts.get(key);
        if (!record) return false;
        if (Date.now() > record.lockedUntil) {
          failedLoginAttempts.delete(key);
          return false;
        }
        return record.attempts >= 5;
      };
      const recordFailedLogin = (key) => {
        const record = failedLoginAttempts.get(key) || { attempts: 0, lockedUntil: 0 };
        record.attempts += 1;
        if (record.attempts >= 5) {
          record.lockedUntil = Date.now() + 15 * 60 * 1000;
        }
        failedLoginAttempts.set(key, record);
      };
      const clearFailedLogin = (key) => {
        failedLoginAttempts.delete(key);
      };

      // Authenticate User Login & Issue Cryptographic Session Token
      server.middlewares.use('/api/auth/login', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
          return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { username, password, selectedRole } = JSON.parse(body || '{}');
            const trimmedInput = (username || '').trim().toLowerCase();
            const trimmedPass = (password || '').trim();

            if (!trimmedInput || !trimmedPass) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Please enter both username and password.' }));
              return;
            }

            // Anti-brute force check
            const rateKey = getRateLimitKey(req, trimmedInput);
            if (isLoginRateLimited(rateKey)) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 429;
              return res.end(JSON.stringify({
                success: false,
                error: 'Too many failed login attempts. Account temporarily locked for 15 minutes for security.'
              }));
            }

            loadEnvVariables();

            // 1. Dynamic Authentication against Supabase vapt_users table
            let matched = null;
            let supabaseMismatch = false;
            let userFoundInDb = false;
            console.log(`\n[AUTH] Login attempt received for "${trimmedInput}" (role requested: ${selectedRole || 'any'})...`);
            try {
              const { data: supaUsers, error: supaErr } = await supabase
                .from('vapt_users')
                .select('*')
                .or(`username.ilike.${trimmedInput},email.ilike.${trimmedInput}`)
                .limit(1);

              if (supaErr) {
                console.error(`[AUTH SUPABASE ERROR] Failed to query Supabase vapt_users table:`, supaErr.message);
              } else if (Array.isArray(supaUsers) && supaUsers.length > 0) {
                userFoundInDb = true;
                const row = supaUsers[0];
                console.log(`[AUTH SUPABASE] User record found for "${row.username}" in Supabase vapt_users table. Checking password...`);
                const valid = verifyPassword(trimmedPass, row.password) || 
                              verifyPassword(trimmedPass, row.alt_password) ||
                              verifyPassword(trimmedPass, row.altPassword);
                if (valid) {
                  console.log(`[AUTH SUCCESS] Password verified for "${row.username}" against Supabase vapt_users table.`);
                  matched = formatUserFromSupabase(row);
                  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
                  try {
                    const supaUpdate = { is_online: true, last_login: nowStr };
                    await supabase.from('vapt_users').update(supaUpdate).eq('id', row.id);
                  } catch (_) {}
                } else {
                  supabaseMismatch = true;
                  console.warn(`[AUTH FAILED] Password mismatch for "${trimmedInput}" against Supabase vapt_users record.`);
                }
              } else {
                console.warn(`[AUTH SUPABASE] No user record found in Supabase vapt_users table for "${trimmedInput}".`);
              }
            } catch (err) {
              console.warn('[AUTH ERROR] Supabase check error:', err.message);
            }

            // 2. Dynamic fallback to local store if Supabase is offline or user not found
            if (!matched && !userFoundInDb) {
              const rawUsers = getGlobalUsersRaw();
              matched = rawUsers.find(u => {
                const uName = (u.username || '').toLowerCase();
                const uEmail = (u.email || '').toLowerCase();
                const matchesUsername = (uName === trimmedInput || uEmail === trimmedInput);
                if (!matchesUsername) return false;
                return verifyPassword(trimmedPass, u.password) || verifyPassword(trimmedPass, u.altPassword);
              });
              if (matched) {
                matched = { ...matched };
                delete matched.password;
                delete matched.altPassword;
                delete matched.passwordHash;
              }
            }

            if (!matched) {
              recordFailedLogin(rateKey);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 401;
              res.end(JSON.stringify({ success: false, error: 'Invalid username or password.' }));
              return;
            }

            if (selectedRole === 'admin' && matched.role !== 'admin') {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 403;
              res.end(JSON.stringify({ success: false, error: 'Access Denied: This account does not have administrator privileges. Please switch to User Login.' }));
              return;
            }

            clearFailedLogin(rateKey);

            const sanitizedUser = { ...matched };
            delete sanitizedUser.password;
            delete sanitizedUser.altPassword;
            delete sanitizedUser.passwordHash;

            const token = createSession(sanitizedUser);

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, token, user: sanitizedUser }));
          } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Authentication failed.' }));
          }
        });
      });

      // Verify Session Token (Frontend startup check)
      server.middlewares.use('/api/auth/verify-session', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Invalid or expired session.' }));
        }
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, user: session.user }));
      });

      // Revoke Session Token (Logout)
      server.middlewares.use('/api/auth/logout', (req, res) => {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : (req.headers['x-auth-token'] || '');
        if (token) {
          activeSessions.delete(token);
        }
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
      });

      // Admin-only User Management Routes
      server.middlewares.use('/api/users/get-users', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session || session.role !== 'admin') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          return res.end(JSON.stringify({ success: false, error: 'Access Denied: Administrator privilege required.' }));
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, users: getSanitizedUsers() }));
      });

      server.middlewares.use('/api/users/create-user', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session || session.role !== 'admin') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          return res.end(JSON.stringify({ success: false, error: 'Access Denied: Administrator privilege required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const userData = JSON.parse(body || '{}');
            const cleanUsername = (userData.username || '').toLowerCase().trim();
            if (!cleanUsername) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: 'Username is required.' }));
            }
            if (!userData.password || !userData.password.trim()) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: 'Password is required.' }));
            }
            const existing = getGlobalUsersRaw();
            if (existing.some(u => u.username?.toLowerCase() === cleanUsername)) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: `User "${cleanUsername}" already exists.` }));
            }
            const newUser = {
              id: `user-${Date.now()}`,
              username: cleanUsername,
              email: userData.email || `${cleanUsername}@sennovate.com`,
              password: userData.password.trim(),
              name: userData.name || userData.username,
              role: userData.role || 'user',
              title: userData.title || (userData.role === 'admin' ? 'Administrator' : 'Security Analyst'),
              avatar: userData.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
              createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
              lastLogin: 'Never',
              isOnline: false,
              scansCount: 0,
              permissions: userData.permissions || {
                run_scans: true,
                view_findings: true,
                attack_graph: true,
                ai_assistant: true,
                export_reports: true,
                view_tokens: false,
                view_terminal: false,
                manage_settings: false,
                manage_users: false,
                load_custom_folder: false
              }
            };
            existing.push(newUser);
            fs.writeFileSync(USERS_STORE_FILE, JSON.stringify(existing, null, 2), 'utf-8');
            try {
              const payload = formatUserForSupabase(newUser);
              supabase.from('vapt_users').upsert([payload], { onConflict: 'username' }).then(() => {}, () => {});
            } catch (_) {}
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, users: getSanitizedUsers() }));
          } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });

      server.middlewares.use('/api/users/delete-user', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session || session.role !== 'admin') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          return res.end(JSON.stringify({ success: false, error: 'Access Denied: Administrator privilege required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { userId } = JSON.parse(body || '{}');
            if (!userId || userId === 'admin') {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: 'Cannot delete primary root administrator account.' }));
            }
            const existing = getGlobalUsersRaw();
            const filtered = existing.filter(u => u.id !== userId && u.username !== userId);
            fs.writeFileSync(USERS_STORE_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
            try {
              supabase.from('vapt_users').delete().or(`id.eq.${userId},username.eq.${userId}`).then(() => {}, () => {});
            } catch (_) {}
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, users: getSanitizedUsers() }));
          } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });

      server.middlewares.use('/api/users/save-users', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session || session.role !== 'admin') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          return res.end(JSON.stringify({ success: false, error: 'Access Denied: Administrator privilege required.' }));
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const users = Array.isArray(data) ? data : data.users;
            if (Array.isArray(users)) {
              saveGlobalUsers(users);
              try {
                const payloads = users.map(formatUserForSupabase);
                if (payloads.length > 0) {
                  supabase.from('vapt_users').upsert(payloads, { onConflict: 'username' }).then(() => {}, () => {});
                }
              } catch (_) {}
            }
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, count: users ? users.length : 0 }));
          } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });

      // 3.6 Full System Backup & Restore Routes (Admin-Only & Secrets Stripped)
      server.middlewares.use('/api/system/export-backup', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session || session.role !== 'admin') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          return res.end(JSON.stringify({ success: false, error: 'Access Denied: Administrator privilege required.' }));
        }
        const backupData = {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          serverConfig: getSanitizedServerConfig(),
          llmConfig: getSanitizedLlmConfig(),
          users: getSanitizedUsers(),
          scans: getServerScanHistory()
        };
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, backup: backupData }));
      });

      server.middlewares.use('/api/system/import-backup', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session || session.role !== 'admin') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          return res.end(JSON.stringify({ success: false, error: 'Access Denied: Administrator privilege required.' }));
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const backup = data.backup || data;
            if (backup.serverConfig) saveGlobalServerConfig(backup.serverConfig);
            if (backup.llmConfig) saveGlobalLlmConfig(backup.llmConfig);
            if (backup.users) saveGlobalUsers(backup.users);
            if (backup.scans) saveServerScanHistory(backup.scans);
            
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, message: 'System snapshot imported and applied successfully' }));
          } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });

      // 4. Test SSH Connection (Admin Only)
      server.middlewares.use('/api/strix/test-ssh', async (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session || session.role !== 'admin') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          return res.end(JSON.stringify({ success: false, error: 'Access Denied: Administrator privilege required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const config = JSON.parse(body);
            const result = await testSshConnection(config);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 3. Start Strix Scan on Ubuntu Server
      server.middlewares.use('/api/strix/start-scan', async (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid session required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body);
            const result = await startRemoteStrixScan(payload);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });

      // 4. Stop / Abort Scan Immediately
      server.middlewares.use('/api/strix/stop-scan', async (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid session required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { scanId } = JSON.parse(body);
            const result = stopRemoteStrixScan(scanId);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });

      // 5. Poll Scan Status and Live Logs (supports POST & GET on /api/strix/status and /api/strix/poll-status)
      const handlePollStatus = (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid session required.' }));
        }
        if (req.method === 'GET') {
          const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          const scanId = urlObj.searchParams.get('scanId');
          const result = getScanSession(scanId);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          return res.end(JSON.stringify(result || { status: 'idle', logs: [], stats: {} }));
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { scanId } = JSON.parse(body || '{}');
              const result = getScanSession(scanId);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(result || { status: 'idle', logs: [], stats: {} }));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end('Method Not Allowed');
      };

      server.middlewares.use('/api/strix/status', handlePollStatus);
      server.middlewares.use('/api/strix/poll-status', handlePollStatus);

      // 6. Send Interactive Stdin Input to Running Scan
      server.middlewares.use('/api/strix/send-input', async (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid session required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { scanId, input } = JSON.parse(body);
            const result = sendInputToScanSession(scanId, input);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });

      // 7. Fetch Real Findings from Remote Ubuntu Server for a Target
      server.middlewares.use('/api/strix/fetch-results', async (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid session required.' }));
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            let config = {};
            if (body) {
              try {
                config = JSON.parse(body);
              } catch(e){}
            }

            const data = await fetchRemoteStrixResults(config, config.targetUrl, config.runDir);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, data }));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 8. Fetch ALL Scan Runs from Server Archive
      server.middlewares.use('/api/strix/fetch-all-runs', async (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid session required.' }));
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            let config = {};
            if (body) {
              try {
                config = JSON.parse(body);
              } catch(e){}
            }

            const runs = await fetchAllRemoteScanRuns(config);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, runs }));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 9. Ingest and Parse Local Strix Output Folder on User PC/Laptop (All 7 Files Engine)
      server.middlewares.use('/api/strix/parse-local-folder', async (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid session required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { folderPath } = JSON.parse(body || '{}');
            if (!folderPath) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: 'Folder name or path is required.' }));
            }

            const result = parseLocalStrixFolder(folderPath);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, data: result }));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 10. Trigger n8n Webhook Scanner with dynamic domain & credentials
      server.middlewares.use('/api/strix/trigger-n8n', async (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid session required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const result = await triggerN8nScanProxy(payload);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 11. List all available downloaded Strix scan folders on user computer
      server.middlewares.use('/api/strix/list-local-folders', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid session required.', folders: [] }));
        }
        try {
          const folders = listLocalScanFolders();
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, folders }));
        } catch (err) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message, folders: [] }));
        }
      });

      // 12. Fetch and download scan results ZIP from n8n webhook
      server.middlewares.use('/api/strix/fetch-n8n-results', async (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid session required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const result = await fetchN8nScanResultsProxy(payload);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 12.4 Check scan.log on Server & Auto-Sync Completed Scan to Supabase
      server.middlewares.use('/api/strix/check-scan-log', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const result = await checkAndSyncScanCompletion(payload);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 12.5 Upload and Ingest Scan Archive (.ZIP) from Downloads
      server.middlewares.use('/api/strix/upload-scan-zip', async (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid session required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const result = await uploadScanZipProxy(payload);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 13. Test n8n Fetch Webhook diagnostic connectivity (Admin Only)
      server.middlewares.use('/api/strix/test-n8n-fetch', async (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session || session.role !== 'admin') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 403;
          return res.end(JSON.stringify({ success: false, error: 'Access Denied: Administrator privilege required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const result = await testN8nFetchWebhookProxy(payload);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = result.status || (result.success !== false ? 200 : 400);
            res.end(JSON.stringify(result));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 14. Directly fetch any arbitrary file from server root
      server.middlewares.use('/api/strix/fetch-server-file', async (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid session required.' }));
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const result = await fetchServerFileProxy(payload);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), strixBackendPlugin()],
  server: {
    port: 5173,
    host: true,
    open: false
  }
});
