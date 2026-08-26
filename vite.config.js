import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
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
  saveGlobalServerConfig
} from './src/server/strixBackend.js';
import path from 'path';
import fs from 'fs';

// Built-in Strix Backend & LLM Proxy Server Plugin
function strixBackendPlugin() {
  return {
    name: 'strix-backend-middleware',
    configureServer(server) {
      // 1. LLM Proxy Route
      server.middlewares.use('/api/llm-proxy', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.statusCode = 200;
          return res.end();
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
      const DEFAULT_SCANS_FILE = path.resolve(process.cwd(), 'data_defaults/default_scans.json');
      const DEFAULT_LLM_FILE = path.resolve(process.cwd(), 'data_defaults/default_llm_config.json');
      const DEFAULT_USERS_FILE = path.resolve(process.cwd(), 'data_defaults/default_users.json');

      const getServerScanHistory = () => {
        try {
          if (fs.existsSync(SCANS_CACHE_FILE)) {
            const data = JSON.parse(fs.readFileSync(SCANS_CACHE_FILE, 'utf-8'));
            if (Array.isArray(data) && data.length > 0) return data;
            if (data && Array.isArray(data.scans) && data.scans.length > 0) return data.scans;
          }
          if (fs.existsSync(DEFAULT_SCANS_FILE)) {
            const data = JSON.parse(fs.readFileSync(DEFAULT_SCANS_FILE, 'utf-8'));
            const scans = Array.isArray(data) ? data : (data?.scans || []);
            if (scans.length > 0) {
              try { fs.writeFileSync(SCANS_CACHE_FILE, JSON.stringify(scans, null, 2), 'utf-8'); } catch (_) {}
              return scans;
            }
          }
        } catch (e) {}
        return [];
      };

      const saveServerScanHistory = (scans) => {
        try {
          fs.writeFileSync(SCANS_CACHE_FILE, JSON.stringify(scans, null, 2), 'utf-8');
          if (fs.existsSync(path.dirname(DEFAULT_SCANS_FILE))) {
            fs.writeFileSync(DEFAULT_SCANS_FILE, JSON.stringify(scans, null, 2), 'utf-8');
          }
          return true;
        } catch (e) {
          return false;
        }
      };

      server.middlewares.use('/api/scans/get-history', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, scans: getServerScanHistory() }));
      });

      server.middlewares.use('/api/scans/save-history', (req, res) => {
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

      // 2. Global Strix Config Get & Save Routes
      server.middlewares.use('/api/strix/get-config', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, config: getGlobalServerConfig() }));
      });

      server.middlewares.use('/api/strix/save-config', (req, res) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const newConf = JSON.parse(body || '{}');
            const saved = saveGlobalServerConfig(newConf);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, config: saved }));
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
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, config: getGlobalLlmConfig() }));
      });

      server.middlewares.use('/api/llm/save-config', (req, res) => {
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

      // 3.5 Global Users Store Get & Save Routes (Persisted in .users_store.json)
      const USERS_STORE_FILE = path.resolve(process.cwd(), '.users_store.json');

      const getGlobalUsers = () => {
        try {
          if (fs.existsSync(USERS_STORE_FILE)) {
            const data = JSON.parse(fs.readFileSync(USERS_STORE_FILE, 'utf-8'));
            if (Array.isArray(data) && data.length > 0) return data;
            if (data && Array.isArray(data.users) && data.users.length > 0) return data.users;
          }
          if (fs.existsSync(DEFAULT_USERS_FILE)) {
            const data = JSON.parse(fs.readFileSync(DEFAULT_USERS_FILE, 'utf-8'));
            const users = Array.isArray(data) ? data : (data?.users || []);
            if (users.length > 0) {
              try { fs.writeFileSync(USERS_STORE_FILE, JSON.stringify(users, null, 2), 'utf-8'); } catch (_) {}
              return users;
            }
          }
        } catch (e) {}
        return null;
      };

      const saveGlobalUsers = (users) => {
        try {
          fs.writeFileSync(USERS_STORE_FILE, JSON.stringify(users, null, 2), 'utf-8');
          if (fs.existsSync(path.dirname(DEFAULT_USERS_FILE))) {
            fs.writeFileSync(DEFAULT_USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
          }
        } catch (e) {}
      };

      server.middlewares.use('/api/users/get-users', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, users: getGlobalUsers() }));
      });

      server.middlewares.use('/api/users/save-users', (req, res) => {
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

      // 3.6 Full System Backup & Restore Routes
      server.middlewares.use('/api/system/export-backup', (req, res) => {
        const backupData = {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          serverConfig: getGlobalServerConfig(),
          llmConfig: getGlobalLlmConfig(),
          users: getGlobalUsers(),
          scans: getServerScanHistory()
        };
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, backup: backupData }));
      });

      server.middlewares.use('/api/system/import-backup', (req, res) => {
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
