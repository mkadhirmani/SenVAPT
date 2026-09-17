import { createClient } from '@supabase/supabase-js';

// Automatically load .env in Node.js execution environments
if (typeof process !== 'undefined' && typeof window === 'undefined') {
  if (typeof process.loadEnvFile === 'function') {
    try { process.loadEnvFile(); } catch (_) {}
  }
}

// Default cloud database endpoints (empty by default - bootstrapped dynamically via authenticated session)
const DEFAULT_SUPA_URL = '';
const DEFAULT_SUPA_KEY = '';

// Function to resolve current active Supabase URL and Anon Key dynamically
export function getActiveSupabaseConfig() {
  let winUrl = (typeof window !== 'undefined' && window.__SUPABASE_CONFIG__) ? window.__SUPABASE_CONFIG__.url : '';
  let winKey = (typeof window !== 'undefined' && window.__SUPABASE_CONFIG__) ? window.__SUPABASE_CONFIG__.key : '';

  if (!winUrl && typeof window !== 'undefined') {
    try {
      const cached = JSON.parse(sessionStorage.getItem('__senvapt_supabase_cfg') || '{}');
      if (cached.url && cached.key) {
        winUrl = cached.url;
        winKey = cached.key;
        window.__SUPABASE_CONFIG__ = cached;
      }
    } catch (_) {}
  }

  const viteUrl = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL) : '';
  const viteKey = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY) : '';

  const nodeUrl = (typeof process !== 'undefined' && process.env) ? (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) : '';
  const nodeKey = (typeof process !== 'undefined' && process.env) ? (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY) : '';

  const url = winUrl || viteUrl || nodeUrl || DEFAULT_SUPA_URL;
  const key = winKey || viteKey || nodeKey || DEFAULT_SUPA_KEY;

  return { url, key };
}

export async function initSupabaseBrowserConfig() {
  if (typeof window === 'undefined') return;
  const token = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('sennovate_auth_token')) ||
                (typeof localStorage !== 'undefined' && localStorage.getItem('sennovate_auth_token'));
  if (!token) return; // Do not attempt unauthenticated fetch

  try {
    const res = await fetch('/api/supabase/config', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.url && data.key) {
        window.__SUPABASE_CONFIG__ = { url: data.url, key: data.key };
        try {
          sessionStorage.setItem('__senvapt_supabase_cfg', JSON.stringify({ url: data.url, key: data.key }));
        } catch (_) {}
        _activeClient = null;
        _cachedUrl = '';
        _cachedKey = '';
      }
    }
  } catch (_) {}
}

export const SUPABASE_URL = getActiveSupabaseConfig().url;
export const SUPABASE_ANON_KEY = getActiveSupabaseConfig().key;

export const isSupabaseConfigured = Boolean(
  getActiveSupabaseConfig().url && 
  getActiveSupabaseConfig().key && 
  getActiveSupabaseConfig().url.startsWith('http')
);

// Universal WebSocket compatibility for Node.js execution environments
if (typeof globalThis.WebSocket === 'undefined' && typeof window === 'undefined') {
  class UniversalWebSocketFallback {
    constructor() { this.readyState = 3; }
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  }
  globalThis.WebSocket = UniversalWebSocketFallback;
}

// Reliable HTTPS fetch adapter for Node.js environments to prevent IPv6/undici connect timeouts
function getNodeHttpsFetch() {
  if (typeof window !== 'undefined' || typeof process === 'undefined' || !process.versions?.node) {
    return null;
  }
  try {
    const getReq = new Function('return typeof require !== "undefined" ? require : null');
    const reqFn = getReq();
    if (!reqFn) return null;
    const https = reqFn('node:https');
    return function (url, options = {}) {
      return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const rawHeaders = options.headers || {};
        const headers = (rawHeaders && typeof rawHeaders.entries === 'function')
          ? Object.fromEntries(rawHeaders.entries())
          : { ...rawHeaders };
        const req = https.request({
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || 443,
          path: parsed.pathname + parsed.search,
          method: options.method || 'GET',
          headers: headers,
          timeout: 10000
        }, (res) => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const bodyBuffer = Buffer.concat(chunks);
            const response = {
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              headers: new Headers(res.headers),
              json: async () => JSON.parse(bodyBuffer.toString('utf-8') || '{}'),
              text: async () => bodyBuffer.toString('utf-8')
            };
            resolve(response);
          });
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('HTTPS request timed out')); });
        req.on('error', reject);
        if (options.body) {
          req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        req.end();
      });
    };
  } catch (_) {
    return null;
  }
}

// Dynamic Client Instance Manager
let _activeClient = null;
let _cachedUrl = '';
let _cachedKey = '';

export function getSupabaseClient() {
  const { url, key } = getActiveSupabaseConfig();
  const effectiveUrl = url || 'https://placeholder-vapt.supabase.co';
  const effectiveKey = key || 'placeholder-anon-key';

  if (!_activeClient || _cachedUrl !== effectiveUrl || _cachedKey !== effectiveKey) {
    _cachedUrl = effectiveUrl;
    _cachedKey = effectiveKey;
    const clientOptions = {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    };
    const nodeFetch = getNodeHttpsFetch();
    if (nodeFetch) {
      clientOptions.global = { fetch: nodeFetch };
    }
    _activeClient = createClient(effectiveUrl, effectiveKey, clientOptions);
  }
  return _activeClient;
}

// Central Supabase Client Proxy (Always routes queries to the live configured project)
export const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabaseClient();
    const val = client[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  }
});

/**
 * Format a scan record for Supabase storage (vapt_scans table)
 * Explicitly excludes raw ZIP archive binaries to keep database lean and fast.
 */
export function formatScanForSupabase(scan) {
  if (!scan) return null;
  const vulns = Array.isArray(scan.vulnerabilities) ? scan.vulnerabilities : [];
  const findingsCount = scan.findingsCount !== undefined ? Number(scan.findingsCount) : vulns.length;
  const critCount = scan.critCount !== undefined ? scan.critCount : vulns.filter(v => v.severity === 'CRITICAL').length;
  const highCount = scan.highCount !== undefined ? scan.highCount : vulns.filter(v => v.severity === 'HIGH').length;
  const medCount = scan.medCount !== undefined ? scan.medCount : vulns.filter(v => v.severity === 'MEDIUM').length;
  const lowCount = scan.lowCount !== undefined ? scan.lowCount : vulns.filter(v => v.severity === 'LOW').length;
  const riskScore = scan.riskScore !== undefined ? scan.riskScore : (vulns.length > 0 ? (vulns[0]?.cvss || 5.5) : 4.0);
  const riskLevel = scan.riskLevel || (critCount > 0 ? 'CRITICAL' : (highCount > 0 ? 'HIGH' : (vulns.length > 0 ? 'ELEVATED' : 'LOW')));

  // Extract pure resultant folder name (never a .zip filename)
  let rawFolder = scan.folderName || scan.metadata?.runId || scan.id || '';
  if (rawFolder.endsWith('.zip')) {
    rawFolder = rawFolder.replace(/\.zip$/i, '');
  }

  // If rawFolder has a path, take the basename
  const segments = rawFolder.split(/[\\\/]/).filter(Boolean);
  const folderName = segments.length > 0 ? segments[segments.length - 1] : `scan-${Date.now()}`;

  const targetUrl = scan.targetUrl || scan.metadata?.targetUrl || 'https://target.com';
  const companyName = scan.companyName || scan.metadata?.companyName || 'Target Organization';

  const cleanDomain = (targetUrl || companyName || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();

  const domPrefix = cleanDomain 
    ? `${cleanDomain}-scan` 
    : (folderName.includes('_') ? `${folderName.split('_')[0].replace(/-/g, '.')}-scan` : 'scan');

  // Determine server resultant folder path (never a .zip file, strictly /root/<domain>-scan/strix_runs/<folder>)
  let outputFolderPath = scan.outputFolderPath || scan.metadata?.remoteRunDir || scan.extractedPath || '';
  if (outputFolderPath.includes('/root/')) {
    outputFolderPath = '/' + outputFolderPath.slice(outputFolderPath.indexOf('root/'));
  }
  if (!outputFolderPath || outputFolderPath.endsWith('.zip')) {
    outputFolderPath = `/root/${domPrefix}/strix_runs/${folderName}`;
  } else if (outputFolderPath.startsWith('/root/strix_runs/')) {
    const fName = outputFolderPath.replace('/root/strix_runs/', '').trim();
    outputFolderPath = `/root/${domPrefix}/strix_runs/${fName || folderName}`;
  } else if (outputFolderPath.startsWith('/strix_runs/')) {
    const fName = outputFolderPath.replace('/strix_runs/', '').trim();
    outputFolderPath = `/root/${domPrefix}/strix_runs/${fName || folderName}`;
  } else if (outputFolderPath.match(/\/?root\/([^\s\r\n│\t,\/]+-scan)\/strix_runs\/([^\s\r\n│\t,\/]+)/i)) {
    const m = outputFolderPath.match(/\/?root\/([^\s\r\n│\t,\/]+-scan)\/strix_runs\/([^\s\r\n│\t,\/]+)/i);
    outputFolderPath = `/root/${m[1]}/strix_runs/${m[2]}`;
  }

  // ID should match the resultant folder run ID
  const id = scan.id && !scan.id.endsWith('.zip') ? scan.id : folderName;

  const durationSec = scan.durationSec || scan.metadata?.durationSec || 240;
  const duration = scan.duration || `${Math.max(1, Math.round(durationSec / 60))} min`;

  return {
    id: id,
    folder_name: folderName,
    output_folder_path: outputFolderPath,
    target_url: targetUrl,
    company_name: companyName,
    timestamp: scan.timestamp || new Date().toISOString().replace('T', ' ').slice(0, 19),
    duration: duration,
    duration_sec: durationSec,
    risk_level: riskLevel,
    risk_score: Number(riskScore) || 4.0,
    findings_count: findingsCount,
    crit_count: critCount,
    high_count: highCount,
    med_count: medCount,
    low_count: lowCount,
    tokens: Number(scan.tokens || scan.metadata?.tokens || 0),
    requests: Number(scan.requests || scan.metadata?.requests || 0),
    cost: Number(scan.cost || scan.metadata?.cost || 0),
    logs: Array.isArray(scan.logs) ? scan.logs.slice(-300) : [],
    vulnerabilities: vulns,
    attack_chain: scan.attackChain || null,
    metadata: {
      ...(scan.metadata || {}),
      runId: folderName,
      targetUrl,
      companyName,
      remoteRunDir: outputFolderPath,
      totalFindings: vulns.length,
      critCount,
      highCount,
      medCount,
      lowCount,
      overallRiskScore: riskScore,
      overallRiskLevel: riskLevel,
      tokens: Number(scan.tokens || scan.metadata?.tokens || 0),
      requests: Number(scan.requests || scan.metadata?.requests || 0),
      cost: Number(scan.cost || scan.metadata?.cost || 0),
      durationSec
    },
    report_markdown: scan.reportMarkdown || '',
    csv_data: scan.csvData || '',
    created_by: scan.createdBy || scan.scannedBy || 'admin',
    scanned_by: scan.scannedBy || scan.createdBy || 'admin',
    scanned_by_name: scan.scannedByName || 'Administrator',
    user_role: scan.userRole || 'User',
    updated_at: new Date().toISOString()
  };
}

/**
 * Save a single structured scan record immediately to Supabase vapt_scans table
 */
export async function saveScanToSupabase(scan) {
  if (!scan) return null;
  try {
    const payload = formatScanForSupabase(scan);
    if (!payload || !payload.id) return null;

    // 1. Direct Supabase Upsert
    const { data, error } = await supabase
      .from('vapt_scans')
      .upsert([payload], { onConflict: 'id' });

    if (error) {
      console.warn('[SUPABASE vapt_scans] Direct upsert note:', error.message);
    } else {
      console.log(`[SUPABASE vapt_scans] Successfully persisted scan "${payload.id}" to Supabase.`);
    }

    // 2. Also notify backend server proxy if running in browser to sync server-side cache
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const token = sessionStorage.getItem('sennovate_auth_token') || localStorage.getItem('sennovate_auth_token');
        fetch('/api/supabase/save-scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload)
        }).catch(() => {});
      } catch (_) {}
    }

    return { success: !error, id: payload.id, data, error: error?.message };
  } catch (err) {
    console.warn('[SUPABASE vapt_scans] Exception saving scan:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Format a database record from Supabase back to dashboard scan object
 */
export function formatScanFromSupabase(row) {
  if (!row) return null;
  const vulns = Array.isArray(row.vulnerabilities) ? row.vulnerabilities : [];
  const critCount = row.crit_count !== undefined ? row.crit_count : vulns.filter(v => v.severity === 'CRITICAL').length;
  const highCount = row.high_count !== undefined ? row.high_count : vulns.filter(v => v.severity === 'HIGH').length;
  const medCount = row.med_count !== undefined ? row.med_count : vulns.filter(v => v.severity === 'MEDIUM').length;
  const lowCount = row.low_count !== undefined ? row.low_count : vulns.filter(v => v.severity === 'LOW').length;
  const riskScore = row.risk_score !== undefined ? row.risk_score : (vulns.length > 0 ? (vulns[0]?.cvss || 5.5) : 4.0);
  const riskLevel = row.risk_level || (critCount > 0 ? 'CRITICAL' : (highCount > 0 ? 'HIGH' : (vulns.length > 0 ? 'ELEVATED' : 'LOW')));
  const targetUrl = row.target_url || row.targetUrl || 'https://target.com';
  const companyName = row.company_name || row.companyName || 'Target Organization';
  const folderName = row.folder_name || row.folderName || row.id;

  const cleanDomain = (targetUrl || companyName || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();

  const domPrefix = cleanDomain 
    ? `${cleanDomain}-scan` 
    : (folderName && folderName.includes('_') ? `${folderName.split('_')[0].replace(/-/g, '.')}-scan` : 'scan');

  let outputFolderPath = row.output_folder_path || row.outputFolderPath || '';
  if (!outputFolderPath || outputFolderPath.endsWith('.zip')) {
    outputFolderPath = `/root/${domPrefix}/strix_runs/${folderName}`;
  } else if (outputFolderPath.startsWith('/root/strix_runs/')) {
    const fName = outputFolderPath.replace('/root/strix_runs/', '').trim();
    outputFolderPath = `/root/${domPrefix}/strix_runs/${fName || folderName}`;
  } else if (outputFolderPath.startsWith('/strix_runs/')) {
    const fName = outputFolderPath.replace('/strix_runs/', '').trim();
    outputFolderPath = `/root/${domPrefix}/strix_runs/${fName || folderName}`;
  } else if (outputFolderPath.match(/\/?root\/([^\s\r\n│\t,\/]+-scan)\/strix_runs\/([^\s\r\n│\t,\/]+)/i)) {
    const m = outputFolderPath.match(/\/?root\/([^\s\r\n│\t,\/]+-scan)\/strix_runs\/([^\s\r\n│\t,\/]+)/i);
    outputFolderPath = `/root/${m[1]}/strix_runs/${m[2]}`;
  }
  const durationSec = row.duration_sec !== undefined ? Number(row.duration_sec) : 240;
  const duration = row.duration || `${Math.max(1, Math.round(durationSec / 60))} min`;

  return {
    id: row.id || folderName,
    folderName,
    outputFolderPath,
    targetUrl,
    companyName,
    timestamp: row.timestamp || row.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19),
    duration,
    durationSec,
    riskLevel,
    riskScore,
    findingsCount: row.findings_count !== undefined ? Number(row.findings_count) : (row.findingsCount !== undefined ? Number(row.findingsCount) : vulns.length),
    critCount,
    highCount,
    medCount,
    lowCount,
    tokens: Number(row.tokens || 0),
    requests: Number(row.requests || 0),
    cost: Number(row.cost || 0),
    logs: Array.isArray(row.logs) ? row.logs : [],
    vulnerabilities: vulns,
    attackChain: row.attack_chain || row.attackChain || null,
    metadata: {
      ...(row.metadata || {}),
      runId: folderName,
      targetUrl,
      companyName,
      remoteRunDir: outputFolderPath,
      totalFindings: vulns.length,
      critCount,
      highCount,
      medCount,
      lowCount,
      overallRiskScore: riskScore,
      overallRiskLevel: riskLevel,
      tokens: Number(row.tokens || 0),
      requests: Number(row.requests || 0),
      cost: Number(row.cost || 0),
      durationSec
    },
    reportMarkdown: row.report_markdown || row.reportMarkdown || '',
    csvData: row.csv_data || row.csvData || '',
    createdBy: row.created_by || row.createdBy || 'user',
    scannedBy: row.scanned_by || row.scannedBy || row.created_by || 'user',
    scannedByName: row.scanned_by_name || row.scannedByName || 'User',
    userRole: row.user_role || row.userRole || 'User'
  };
}

/**
 * Format a user record for Supabase storage (vapt_users table)
 * Security rule: Plaintext passwords are NEVER stored in the database.
 * Only cryptographically secure PBKDF2 hashes are accepted.
 */
export function formatUserForSupabase(user) {
  if (!user) return null;
  let rawPassword = user.password || user.plainPassword || user.rawPassword || '';

  const payload = {
    id: user.id || `user-${Date.now()}`,
    username: (user.username || '').toLowerCase().trim(),
    email: user.email || `${(user.username || '').toLowerCase().trim()}@sennovate.com`,
    name: user.name || user.username || 'User',
    role: user.role || 'user',
    title: user.title || (user.role === 'admin' ? 'Administrator' : 'Security Analyst'),
    avatar: user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`,
    permissions: user.permissions || {},
    is_online: Boolean(user.isOnline || user.is_online),
    last_login: user.lastLogin || user.last_login || 'Never',
    scans_count: Number(user.scansCount || user.scans_count || 0),
    created_at: user.createdAt || user.created_at || new Date().toISOString()
  };

  // Only include password if it is already a secure PBKDF2 hash. Never send plaintext!
  if (rawPassword && typeof rawPassword === 'string' && rawPassword.startsWith('pbkdf2$')) {
    payload.password = rawPassword;
  }

  return payload;
}

/**
 * Format a database record from Supabase back to dashboard user object
 * Security rule: Password hashes are NEVER returned to the client-side state.
 */
export function formatUserFromSupabase(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    password: '', // Redacted for security; never returned to frontend
    name: row.name || row.username || 'User',
    role: row.role || 'user',
    title: row.title || (row.role === 'admin' ? 'Administrator' : 'Security Analyst'),
    avatar: row.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${row.username}`,
    permissions: row.permissions || {},
    isOnline: Boolean(row.is_online !== undefined ? row.is_online : row.isOnline),
    lastLogin: row.last_login || row.lastLogin || 'Never',
    scansCount: Number(row.scans_count !== undefined ? row.scans_count : (row.scansCount || 0)),
    createdAt: row.created_at || row.createdAt || ''
  };
}
