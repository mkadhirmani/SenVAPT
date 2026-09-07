import { createClient } from '@supabase/supabase-js';

// Automatically load .env in Node.js execution environments
if (typeof process !== 'undefined' && typeof window === 'undefined') {
  if (typeof process.loadEnvFile === 'function') {
    try { process.loadEnvFile(); } catch (_) {}
  }
}

// Function to resolve current active Supabase URL and Anon Key dynamically
export function getActiveSupabaseConfig() {
  const winUrl = (typeof window !== 'undefined' && window.__SUPABASE_CONFIG__) ? window.__SUPABASE_CONFIG__.url : '';
  const winKey = (typeof window !== 'undefined' && window.__SUPABASE_CONFIG__) ? window.__SUPABASE_CONFIG__.key : '';

  const viteUrl = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_SUPABASE_URL : '';
  const viteKey = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_SUPABASE_ANON_KEY : '';

  const nodeUrl = (typeof process !== 'undefined' && process.env) ? (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) : '';
  const nodeKey = (typeof process !== 'undefined' && process.env) ? (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY) : '';

  const url = viteUrl || winUrl || nodeUrl || '';
  const key = viteKey || winKey || nodeKey || '';

  return { url, key };
}

export async function initSupabaseBrowserConfig() {
  if (typeof window === 'undefined') return;
  const { url, key } = getActiveSupabaseConfig();
  if (!url || !key || url.includes('placeholder')) {
    try {
      const res = await fetch('/api/supabase/config');
      if (res.ok) {
        const data = await res.json();
        if (data && data.url && data.key) {
          window.__SUPABASE_CONFIG__ = { url: data.url, key: data.key };
          _activeClient = null;
          _cachedUrl = '';
          _cachedKey = '';
        }
      }
    } catch (_) {}
  }
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
    _activeClient = createClient(effectiveUrl, effectiveKey, {
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
    });
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

  // Determine server resultant folder path (never a .zip file)
  let outputFolderPath = scan.outputFolderPath || scan.metadata?.remoteRunDir || scan.extractedPath || '';
  if (outputFolderPath.includes('/root/')) {
    outputFolderPath = '/' + outputFolderPath.slice(outputFolderPath.indexOf('root/'));
  }
  if (outputFolderPath.endsWith('.zip') || !outputFolderPath) {
    outputFolderPath = `/root/strix_runs/${rawFolder}`;
  }

  // If rawFolder has a path, take the basename
  const segments = rawFolder.split(/[\\\/]/).filter(Boolean);
  const folderName = segments.length > 0 ? segments[segments.length - 1] : `scan-${Date.now()}`;

  // ID should match the resultant folder run ID
  const id = scan.id && !scan.id.endsWith('.zip') ? scan.id : folderName;

  const targetUrl = scan.targetUrl || scan.metadata?.targetUrl || 'https://target.com';
  const companyName = scan.companyName || scan.metadata?.companyName || 'Target Organization';
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
 * Format a database record from Supabase back to dashboard scan object
 */
export function formatScanFromSupabase(row) {
  if (!row) return null;
  const vulns = Array.isArray(row.vulnerabilities) ? row.vulnerabilities : [];
  const critCount = row.crit_count !== undefined ? Number(row.crit_count) : (row.critCount !== undefined ? Number(row.critCount) : vulns.filter(v => v.severity === 'CRITICAL').length);
  const highCount = row.high_count !== undefined ? Number(row.high_count) : (row.highCount !== undefined ? Number(row.highCount) : vulns.filter(v => v.severity === 'HIGH').length);
  const medCount = row.med_count !== undefined ? Number(row.med_count) : (row.medCount !== undefined ? Number(row.medCount) : vulns.filter(v => v.severity === 'MEDIUM').length);
  const lowCount = row.low_count !== undefined ? Number(row.low_count) : (row.lowCount !== undefined ? Number(row.lowCount) : vulns.filter(v => v.severity === 'LOW').length);
  const riskScore = row.risk_score !== undefined ? Number(row.risk_score) : (row.riskScore !== undefined ? Number(row.riskScore) : (vulns.length > 0 ? (vulns[0]?.cvss || 5.5) : 4.0));
  const riskLevel = row.risk_level || row.riskLevel || (critCount > 0 ? 'CRITICAL' : (highCount > 0 ? 'HIGH' : (vulns.length > 0 ? 'ELEVATED' : 'LOW')));

  const id = row.id || row.folder_name || row.folderName || `scan-${Date.now()}`;
  const folderName = row.folder_name || row.folderName || id;
  const outputFolderPath = row.output_folder_path || row.outputFolderPath || '';
  const targetUrl = row.target_url || row.targetUrl || 'https://target.com';
  const companyName = row.company_name || row.companyName || 'Target Organization';
  const durationSec = Number(row.duration_sec || row.durationSec || 240);
  const duration = row.duration || `${Math.max(1, Math.round(durationSec / 60))} min`;

  return {
    id,
    folderName,
    outputFolderPath,
    targetUrl,
    companyName,
    timestamp: row.timestamp || new Date().toISOString().replace('T', ' ').slice(0, 19),
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
 */
export function formatUserForSupabase(user) {
  if (!user) return null;
  return {
    id: user.id || `user-${Date.now()}`,
    username: (user.username || '').toLowerCase().trim(),
    email: user.email || `${(user.username || '').toLowerCase().trim()}@sennovate.com`,
    password: user.password || '',
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
}

/**
 * Format a database record from Supabase back to dashboard user object
 */
export function formatUserFromSupabase(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    password: row.password || '',
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
