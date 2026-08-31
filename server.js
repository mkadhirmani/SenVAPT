import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0';
const DIST_DIR = path.join(__dirname, 'dist');
const SCANS_CACHE_FILE = path.join(__dirname, '.scans_cache.json');
const LLM_CONFIG_FILE = path.join(__dirname, '.llm_config.json');

// MIME types dictionary for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

const DEFAULT_SCANS_FILE = path.join(__dirname, 'data_defaults', 'default_scans.json');
const DEFAULT_LLM_FILE = path.join(__dirname, 'data_defaults', 'default_llm_config.json');
const DEFAULT_USERS_FILE = path.join(__dirname, 'data_defaults', 'default_users.json');

// Global Server-Side Scan Cache Helper
function getServerScanHistory() {
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
        try {
          fs.writeFileSync(SCANS_CACHE_FILE, JSON.stringify(scans, null, 2), 'utf-8');
        } catch (_) {}
        return scans;
      }
    }
  } catch (e) {
    console.warn('Note reading server scan history:', e.message);
  }
  return [];
}

function saveServerScanHistory(scans) {
  try {
    fs.writeFileSync(SCANS_CACHE_FILE, JSON.stringify(scans, null, 2), 'utf-8');
    if (fs.existsSync(path.dirname(DEFAULT_SCANS_FILE))) {
      fs.writeFileSync(DEFAULT_SCANS_FILE, JSON.stringify(scans, null, 2), 'utf-8');
    }
    return true;
  } catch (e) {
    console.error('Error saving server scan history:', e.message);
    return false;
  }
}

// Global LLM Config Helper
function getGlobalLlmConfig() {
  try {
    if (fs.existsSync(LLM_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(LLM_CONFIG_FILE, 'utf-8'));
    }
    if (fs.existsSync(DEFAULT_LLM_FILE)) {
      const data = JSON.parse(fs.readFileSync(DEFAULT_LLM_FILE, 'utf-8'));
      try {
        fs.writeFileSync(LLM_CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
      } catch (_) {}
      return data;
    }
  } catch (e) {}
  return null;
}

function saveGlobalLlmConfig(conf) {
  try {
    fs.writeFileSync(LLM_CONFIG_FILE, JSON.stringify(conf, null, 2), 'utf-8');
    if (fs.existsSync(path.dirname(DEFAULT_LLM_FILE))) {
      fs.writeFileSync(DEFAULT_LLM_FILE, JSON.stringify(conf, null, 2), 'utf-8');
    }
  } catch (e) {}
}

// Global Users Store Helper
const USERS_STORE_FILE = path.join(__dirname, '.users_store.json');

const getDefaultUsersSeed = () => [
  {
    id: 'admin',
    username: 'admin',
    email: 'admin@sennovate.com',
    password: process.env.ADMIN_PASSWORD || '',
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
    password: process.env.USER_PASSWORD || '',
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
    password: process.env.SALES_PASSWORD || '',
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

function getGlobalUsersStoreRaw() {
  try {
    if (fs.existsSync(USERS_STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_STORE_FILE, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) return data;
      if (data && Array.isArray(data.users) && data.users.length > 0) return data.users;
    }
  } catch (e) {}
  const defaults = getDefaultUsersSeed();
  try { fs.writeFileSync(USERS_STORE_FILE, JSON.stringify(defaults, null, 2), 'utf-8'); } catch (_) {}
  return defaults;
}

function getSanitizedUsersStore() {
  const users = getGlobalUsersStoreRaw();
  return users.map(u => {
    const sanitized = { ...u };
    delete sanitized.password;
    delete sanitized.altPassword;
    delete sanitized.passwordHash;
    return sanitized;
  });
}

function saveGlobalUsersStore(users) {
  try {
    const existingRaw = getGlobalUsersStoreRaw();
    const merged = users.map(u => {
      const match = existingRaw.find(e => e.id === u.id || e.username === u.username);
      return {
        ...u,
        password: u.password || match?.password || process.env.USER_PASSWORD || ''
      };
    });
    fs.writeFileSync(USERS_STORE_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

// Helper to parse JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', err => reject(err));
  });
}

// Create Production HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Set CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  // ==========================================
  // API ROUTES
  // ==========================================

  // 1. Health Check
  if (pathname === '/health' || pathname === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }));
  }

  // 0. Cloud Run & Container Health Check Endpoint
  if (pathname === '/healthz' || pathname === '/health' || pathname === '/_health') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.statusCode = 200;
    return res.end('OK');
  }

  // 1. Downloaded Scan Files Listing Routery Sync
  if (pathname === '/api/scans/get-history') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: true, scans: getServerScanHistory() }));
  }

  if (pathname === '/api/scans/save-history') {
    const payload = await parseJsonBody(req);
    const scansList = Array.isArray(payload) ? payload : (payload.scans || []);
    const ok = saveServerScanHistory(scansList);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = ok ? 200 : 500;
    return res.end(JSON.stringify({ success: ok, count: scansList.length }));
  }

  // 3. LLM Proxy Route
  if (pathname === '/api/llm-proxy') {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.end('Method Not Allowed');
    }
    try {
      const { targetUrl, headers, data } = await parseJsonBody(req);
      const fetchRes = await fetch(targetUrl, {
        method: 'POST',
        headers: headers || { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const status = fetchRes.status;
      const resText = await fetchRes.text();
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = status;
      return res.end(resText);
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 4. Strix Config Routes
  if (pathname === '/api/strix/get-config') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: true, config: getGlobalServerConfig() }));
  }

  if (pathname === '/api/strix/save-config') {
    try {
      const newConf = await parseJsonBody(req);
      const saved = saveGlobalServerConfig(newConf);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, config: saved }));
    } catch (e) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // 5. LLM Config Routes
  if (pathname === '/api/llm/get-config') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: true, config: getGlobalLlmConfig() }));
  }

  if (pathname === '/api/llm/save-config') {
    try {
      const conf = await parseJsonBody(req);
      saveGlobalLlmConfig(conf);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, config: conf }));
    } catch (e) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // 5.5 Users Store & Auth Routes
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const { username, password, selectedRole } = await parseJsonBody(req);
      const trimmedInput = (username || '').trim().toLowerCase();
      const trimmedPass = (password || '').trim();

      if (!trimmedInput || !trimmedPass) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 400;
        return res.end(JSON.stringify({ success: false, error: 'Please enter both username and password.' }));
      }

      const rawUsers = getGlobalUsersStoreRaw();
      const matched = rawUsers.find(u =>
        (u.username?.toLowerCase() === trimmedInput || u.email?.toLowerCase() === trimmedInput) &&
        (u.password === trimmedPass || u.altPassword === trimmedPass)
      );

      if (!matched) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 401;
        return res.end(JSON.stringify({ success: false, error: 'Invalid credentials. Please enter a valid username and password.' }));
      }

      if (selectedRole === 'admin' && matched.role !== 'admin') {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 403;
        return res.end(JSON.stringify({ success: false, error: 'Access Denied: This account does not have administrator privileges. Please switch to User Login.' }));
      }

      const sanitizedUser = { ...matched };
      delete sanitizedUser.password;
      delete sanitizedUser.altPassword;
      delete sanitizedUser.passwordHash;

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, user: sanitizedUser }));
    } catch (e) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  if (pathname === '/api/users/get-users') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: true, users: getSanitizedUsersStore() }));
  }

  if (pathname === '/api/users/save-users') {
    try {
      const data = await parseJsonBody(req);
      const users = Array.isArray(data) ? data : data.users;
      if (Array.isArray(users)) {
        saveGlobalUsersStore(users);
      }
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, count: users ? users.length : 0 }));
    } catch (e) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // 5.6 Full System Backup & Restore Routes
  if (pathname === '/api/system/export-backup') {
    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      serverConfig: getGlobalServerConfig(),
      llmConfig: getGlobalLlmConfig(),
      users: getGlobalUsersStore(),
      scans: getServerScanHistory()
    };
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: true, backup: backupData }));
  }

  if (pathname === '/api/system/import-backup') {
    try {
      const data = await parseJsonBody(req);
      const backup = data.backup || data;
      if (backup.serverConfig) saveGlobalServerConfig(backup.serverConfig);
      if (backup.llmConfig) saveGlobalLlmConfig(backup.llmConfig);
      if (backup.users) saveGlobalUsersStore(backup.users);
      if (backup.scans) saveServerScanHistory(backup.scans);
      
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, message: 'System snapshot imported and applied successfully' }));
    } catch (e) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // 6. Test SSH Connection
  if (pathname === '/api/strix/test-ssh') {
    try {
      const config = await parseJsonBody(req);
      const result = await testSshConnection(config);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // 7. Start Strix Scan on Server
  if (pathname === '/api/strix/start-scan') {
    try {
      const payload = await parseJsonBody(req);
      const result = await startRemoteStrixScan(payload);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 8. Stop Scan
  if (pathname === '/api/strix/stop-scan') {
    try {
      const { scanId } = await parseJsonBody(req);
      const result = stopRemoteStrixScan(scanId);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 9. Poll Status
  if (pathname === '/api/strix/status' || pathname === '/api/strix/poll-status') {
    try {
      let scanId = parsedUrl.searchParams.get('scanId');
      if (!scanId && req.method === 'POST') {
        const body = await parseJsonBody(req);
        scanId = body.scanId;
      }
      const result = getScanSession(scanId);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify(result || { status: 'idle', logs: [], stats: {} }));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 10. Fetch Remote Results
  if (pathname === '/api/strix/fetch-results') {
    try {
      const config = await parseJsonBody(req);
      const data = await fetchRemoteStrixResults(config, config.targetUrl, config.runDir);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, data }));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // 11. Fetch All Remote Scan Runs
  if (pathname === '/api/strix/fetch-all-runs') {
    try {
      const config = await parseJsonBody(req);
      const runs = await fetchAllRemoteScanRuns(config);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, runs }));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // 12. Parse Local Folder
  if (pathname === '/api/strix/parse-local-folder') {
    try {
      const { folderPath } = await parseJsonBody(req);
      if (!folderPath) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 400;
        return res.end(JSON.stringify({ success: false, error: 'Folder name or path is required.' }));
      }
      const result = parseLocalStrixFolder(folderPath);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, data: result }));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // 13. Trigger n8n Scan
  if (pathname === '/api/strix/trigger-n8n') {
    try {
      const payload = await parseJsonBody(req);
      const result = await triggerN8nScanProxy(payload);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // 14. List Local Folders
  if (pathname === '/api/strix/list-local-folders') {
    try {
      const folders = listLocalScanFolders();
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, folders }));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      return res.end(JSON.stringify({ success: false, error: err.message, folders: [] }));
    }
  }

  // 15. Fetch n8n Scan Results ZIP
  if (pathname === '/api/strix/fetch-n8n-results') {
    try {
      const payload = await parseJsonBody(req);
      const result = await fetchN8nScanResultsProxy(payload);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // 15.5 Upload Scan ZIP from user downloads
  if (pathname === '/api/strix/upload-scan-zip') {
    try {
      const payload = await parseJsonBody(req);
      const result = await uploadScanZipProxy(payload);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // 16. Test n8n Fetch Webhook
  if (pathname === '/api/strix/test-n8n-fetch') {
    try {
      const payload = await parseJsonBody(req);
      const result = await testN8nFetchWebhookProxy(payload);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // 17. Fetch Server File
  if (pathname === '/api/strix/fetch-server-file') {
    try {
      const payload = await parseJsonBody(req);
      const result = await fetchServerFileProxy(payload);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // ==========================================
  // STATIC ASSETS & SPA ROUTING
  // ==========================================
  if (req.method === 'GET' || req.method === 'HEAD') {
    let cleanPath = pathname;
    try { cleanPath = decodeURIComponent(pathname); } catch (_) {}
    let filePath = path.join(DIST_DIR, cleanPath);

    // Prevent directory traversal
    if (!filePath.startsWith(DIST_DIR)) {
      res.statusCode = 403;
      return res.end('Forbidden');
    }

    // Check if the requested file exists in dist
    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=31536000');
        res.statusCode = 200;
        return fs.createReadStream(filePath).pipe(res);
      }

      // Fallback check in public folder
      const publicPath = path.join(__dirname, 'public', cleanPath);
      fs.stat(publicPath, (pErr, pStats) => {
        if (!pErr && pStats.isFile()) {
          const ext = path.extname(publicPath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=31536000');
          res.statusCode = 200;
          return fs.createReadStream(publicPath).pipe(res);
        }

        // If file not found or is directory, fallback to index.html for Single Page App client-side routing
        const indexFile = path.join(DIST_DIR, 'index.html');
        fs.stat(indexFile, (idxErr, idxStats) => {
          if (!idxErr && idxStats.isFile()) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.statusCode = 200;
            return fs.createReadStream(indexFile).pipe(res);
          }

          res.statusCode = 404;
          res.end('Not Found - Build frontend with npm run build');
        });
      });
    });
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
});

server.on('error', (err) => {
  console.error('Server startup or connection error:', err);
});

server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(`🛡️  Sennovate Autonomous VAPT Dashboard Server`);
  console.log(`🚀  Listening on http://${HOST}:${PORT}`);
  console.log(`📁  Serving static assets from: ${DIST_DIR}`);
  console.log(`====================================================`);
});
