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
  testN8nFetchWebhookProxy,
  fetchServerFileProxy,
  getGlobalServerConfig,
  saveGlobalServerConfig
} from './src/server/strixBackend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
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

// Global Server-Side Scan Cache Helper
function getServerScanHistory() {
  try {
    if (fs.existsSync(SCANS_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SCANS_CACHE_FILE, 'utf-8'));
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.scans)) return data.scans;
    }
  } catch (e) {
    console.warn('Note reading server scan history:', e.message);
  }
  return [];
}

function saveServerScanHistory(scans) {
  try {
    fs.writeFileSync(SCANS_CACHE_FILE, JSON.stringify(scans, null, 2), 'utf-8');
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
  } catch (e) {}
  return null;
}

function saveGlobalLlmConfig(conf) {
  try {
    fs.writeFileSync(LLM_CONFIG_FILE, JSON.stringify(conf, null, 2), 'utf-8');
  } catch (e) {}
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

  // 2. Server Scan History Sync
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
    let filePath = path.join(DIST_DIR, pathname);

    // Prevent directory traversal
    if (!filePath.startsWith(DIST_DIR)) {
      res.statusCode = 403;
      return res.end('Forbidden');
    }

    // Check if the requested file exists
    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=31536000');
        res.statusCode = 200;
        return fs.createReadStream(filePath).pipe(res);
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
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(`🛡️  Sennovate Autonomous VAPT Dashboard Server`);
  console.log(`🚀  Listening on http://${HOST}:${PORT}`);
  console.log(`📁  Serving static assets from: ${DIST_DIR}`);
  console.log(`====================================================`);
});
