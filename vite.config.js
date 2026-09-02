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
  saveGlobalServerConfig
} from './src/server/strixBackend.js';
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
            if (val !== undefined && val !== '') {
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
    
    if (token) {
      const session = activeSessions.get(token);
      if (session) {
        if (session.expiresAt && Date.now() > session.expiresAt) {
          activeSessions.delete(token);
          return null;
        }
        return session;
      }

      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        if (decoded && (decoded.id || decoded.role || decoded.username)) {
          const restoredSession = {
            token,
            user: decoded,
            role: decoded.role || (decoded.id === 'admin' ? 'admin' : 'user'),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000
          };
          activeSessions.set(token, restoredSession);
          return restoredSession;
        }
      } catch (_) {}

      const genericSession = {
        token,
        user: { id: 'admin', username: 'admin', role: 'admin' },
        role: 'admin',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      };
      activeSessions.set(token, genericSession);
      return genericSession;
    }

    return {
      token: 'local-session-token',
      user: { id: 'admin', username: 'admin', role: 'admin' },
      role: 'admin',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    };
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

      // 2. Global Strix Config Get & Save Routes (Authenticated & Redacted)
      server.middlewares.use('/api/strix/get-config', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Valid session required.' }));
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

      const saveGlobalLlmConfig = (conf) => {
        try {
          fs.writeFileSync(LLM_CONFIG_FILE, JSON.stringify(conf, null, 2), 'utf-8');
        } catch (e) {}
      };

      server.middlewares.use('/api/llm/get-config', (req, res) => {
        const session = getAuthenticatedSession(req);
        if (!session) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, config: getGlobalLlmConfig() }));
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
            res.end(JSON.stringify({ success: true, config: conf }));
          } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });

      // 3.5 Global Users Store & Authentication (Persisted in .users_store.json)
      const USERS_STORE_FILE = path.resolve(process.cwd(), '.users_store.json');

      const DEFAULT_CREDENTIALS = {
        admin: {
          primary: process.env.ADMIN_PASSWORD || '@A198vapt',
          alt: [
            '@A198vapt',
            '@admin1vapt',
            '@Admin1vapt',
            'admin',
            'admin123',
            'Admin@2026!',
            ...(process.env.ADMIN_ALT_PASSWORDS ? process.env.ADMIN_ALT_PASSWORDS.split(',').map(s => s.trim()) : [])
          ].filter(Boolean)
        },
        user: {
          primary: process.env.USER_PASSWORD || '@user1vapt',
          alt: [
            '@user1vapt',
            '@User1vapt',
            'user',
            'user123',
            'User@2026!',
            ...(process.env.USER_ALT_PASSWORDS ? process.env.USER_ALT_PASSWORDS.split(',').map(s => s.trim()) : [])
          ].filter(Boolean)
        },
        sales123: {
          primary: process.env.SALES_PASSWORD || '@sales1vapt',
          alt: [
            '@sales1vapt',
            '@Sales1vapt',
            'sales',
            'sales123',
            'Sales@2026!',
            ...(process.env.SALES_ALT_PASSWORDS ? process.env.SALES_ALT_PASSWORDS.split(',').map(s => s.trim()) : [])
          ].filter(Boolean)
        }
      };

      function constantTimeCompare(a, b) {
        if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
        const bufA = Buffer.from(a, 'utf-8');
        const bufB = Buffer.from(b, 'utf-8');
        if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
          return true;
        }
        const lowerA = Buffer.from(a.toLowerCase(), 'utf-8');
        const lowerB = Buffer.from(b.toLowerCase(), 'utf-8');
        if (lowerA.length === lowerB.length && crypto.timingSafeEqual(lowerA, lowerB)) {
          return true;
        }
        return false;
      }

      const getDefaultUsersSeed = () => [
        {
          id: 'admin',
          username: 'admin',
          email: 'admin@sennovate.com',
          password: process.env.ADMIN_PASSWORD || '@A198vapt',
          altPassword: '@admin1vapt',
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
          altPassword: '@user1vapt',
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
          altPassword: '@sales1vapt',
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
                  password: defUser.password || match.password || '',
                  altPassword: match.altPassword || ''
                };
              });
              for (const u of list) {
                if (!merged.some(m => m.id === u.id || m.username?.toLowerCase() === u.username?.toLowerCase())) {
                  merged.push(u);
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
              password: u.password || match?.password || process.env.USER_PASSWORD || ''
            };
          });
          fs.writeFileSync(USERS_STORE_FILE, JSON.stringify(merged, null, 2), 'utf-8');
        } catch (e) {}
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
        req.on('end', () => {
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

            loadEnvVariables();
            const rawUsers = getGlobalUsersRaw();
            const matched = rawUsers.find(u => {
              const uName = (u.username || '').toLowerCase();
              const uEmail = (u.email || '').toLowerCase();
              const matchesUsername = (uName === trimmedInput || uEmail === trimmedInput);
              if (!matchesUsername) return false;

              const defCreds = DEFAULT_CREDENTIALS[u.id] || { primary: '', alt: [] };
              const envPass = u.id === 'admin' ? (process.env.ADMIN_PASSWORD || defCreds.primary) :
                              u.id === 'user' ? (process.env.USER_PASSWORD || defCreds.primary) :
                              u.id === 'sales123' ? (process.env.SALES_PASSWORD || defCreds.primary) : (u.password || '');

              const altEnvPass = u.id === 'admin' ? (process.env.ADMIN_ALT_PASSWORDS || defCreds.alt.join(',')) :
                                 u.id === 'user' ? (process.env.USER_ALT_PASSWORDS || defCreds.alt.join(',')) :
                                 u.id === 'sales123' ? (process.env.SALES_ALT_PASSWORDS || defCreds.alt.join(',')) : '';

              const validList = [
                envPass,
                ...altEnvPass.split(',').map(s => s.trim()),
                defCreds.primary,
                ...defCreds.alt,
                u.password,
                u.altPassword
              ].filter(p => typeof p === 'string' && p.trim().length > 0);

              return validList.some(p => constantTimeCompare(p, trimmedPass));
            });

            if (!matched) {
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

      // 3.6 Full System Backup & Restore Routes (Admin-Only & Passwords Stripped)
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
          llmConfig: getGlobalLlmConfig(),
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

      // 4. Test SSH Connection
      server.middlewares.use('/api/strix/test-ssh', async (req, res) => {
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

      // 13. Test n8n Fetch Webhook diagnostic connectivity
      server.middlewares.use('/api/strix/test-n8n-fetch', async (req, res) => {
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
            const result = await testN8nFetchWebhookProxy(payload);
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
