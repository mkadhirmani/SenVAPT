// Strix Backend API & SSH Store
import { getAuthHeaders } from './auth';

const STRIX_CONFIG_KEY = 'sennovate_strix_ssh_config';

export function getStrixServerConfig() {
  try {
    const saved = localStorage.getItem(STRIX_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Clean up legacy arguments if present
      if (parsed.command && (parsed.command.includes('scan') || parsed.command.includes('--output'))) {
        parsed.command = 'strix -t "{target}" -n';
      }
      if (!parsed.strixLlm) {
        parsed.strixLlm = 'openrouter/deepseek/deepseek-v4-flash';
      }
      return parsed;
    }
  } catch (e) {
    console.error('Error reading Strix config:', e);
  }

  return {
    enabled: true,
    triggerMode: 'n8n',
    n8nWebhookUrl: 'https://n8n-route-soc-pub-vms.apps.corp.sennovate.com/webhook/8fdd9fff-57fa-4401-94b7-e06daa92ea36',
    n8nFetchWebhookUrl: 'https://n8n-route-soc-pub-vms.apps.corp.sennovate.com/webhook/1bc30fe0-e31f-4cdb-91fd-d15d4f20ede3',
    n8nAuthType: 'basic',
    n8nCredential: '',
    n8nUsername: '',
    n8nPassword: '',
    n8nToken: '',
    host: '',
    port: 22,
    username: 'ubuntu',
    password: '',
    privateKey: '',
    authType: 'password',
    runAsRoot: true,
    command: 'strix -t "{target}" -n',
    strixLlm: 'openrouter/deepseek/deepseek-v4-flash',
    openrouterApiKey: '',
    llmApiKey: '',
    llmApiBase: '',
    remoteOutputDir: '/root/strix_runs',
    lastConnected: null
  };
}

/**
 * Fetch global config configured by Admin from the backend server
 */
export async function fetchStrixServerConfig() {
  try {
    const res = await fetch('/api/strix/get-config', {
      headers: { ...getAuthHeaders() }
    });
    if (res.ok) {
      const data = await res.json();
      const local = getStrixServerConfig();
      const serverConfig = data.config;

      let merged = { ...local };
      if (serverConfig && typeof serverConfig === 'object') {
        merged = { ...local, ...serverConfig };
      }

      localStorage.setItem(STRIX_CONFIG_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('strix_config_updated', { detail: merged }));
      return merged;
    }
  } catch (e) {
    console.warn('Note syncing global strix server config:', e);
  }
  return getStrixServerConfig();
}

export function saveStrixServerConfig(config) {
  try {
    const cleaned = { ...config };
    if (cleaned.command && (cleaned.command.includes('scan') || cleaned.command.includes('--output'))) {
      cleaned.command = 'strix -t "{target}" -n';
    }
    localStorage.setItem(STRIX_CONFIG_KEY, JSON.stringify(cleaned));
    
    // Sync with backend so all user sessions immediately inherit this configuration
    fetch('/api/strix/save-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(cleaned)
    }).catch(err => console.warn('Note syncing server config to backend:', err));

    // Broadcast update across the client window
    window.dispatchEvent(new CustomEvent('strix_config_updated', { detail: cleaned }));
  } catch (e) {
    console.error('Error saving Strix config:', e);
  }
}

/**
 * Test SSH Connection to Strix Machine (Step 1: ssh ubuntu -> Step 2: sudo -i -> Step 3: strix)
 */
export async function testStrixSshConnection(config) {
  const res = await fetch('/api/strix/test-ssh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(config)
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'SSH Connection Failed');
  }

  const updated = { ...config, lastConnected: new Date().toISOString() };
  saveStrixServerConfig(updated);

  return data;
}

/**
 * Start Strix Scan on Ubuntu Server in Root
 */
export async function startStrixScan(params) {
  const config = getStrixServerConfig();
  const payload = {
    ...config,
    ...params,
    runAsRoot: true,
    scanId: params.scanId || `strix-${Date.now()}`
  };

  const res = await fetch('/api/strix/start-scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to start Strix scan');
  }

  return data;
}

/**
 * Stop / Abort Strix Scan Immediately
 */
export async function stopStrixScan(scanId) {
  const res = await fetch('/api/strix/stop-scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ scanId })
  });

  return await res.json();
}

/**
 * Send interactive stdin input to the running Strix scan
 */
export async function sendStrixInput(scanId, input) {
  const res = await fetch('/api/strix/send-input', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ scanId, input })
  });

  return await res.json();
}

/**
 * Poll live scan status and logs from Strix server
 */
export async function pollStrixScanStatus(scanId) {
  const res = await fetch(`/api/strix/status?scanId=${encodeURIComponent(scanId)}`, {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) {
    throw new Error('Failed to retrieve scan logs');
  }
  return await res.json();
}

/**
 * Fetch real findings from the Remote Ubuntu Machine for the target URL and run directory
 */
export async function fetchStrixScanResults(targetUrl, runDir) {
  const config = getStrixServerConfig();
  const res = await fetch('/api/strix/fetch-results', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ ...config, targetUrl, runDir })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch scan results');
  }

  return data.data;
}

/**
 * Trigger n8n Webhook Scanner with dynamic target domain and credentials
 */
export async function triggerN8nScan(params) {
  const config = getStrixServerConfig();
  const payload = {
    webhookUrl: params?.webhookUrl || config.n8nWebhookUrl,
    domain: params?.domain || params?.targetUrl || 'example.com',
    authType: params?.authType || config.n8nAuthType || 'basic',
    credential: params?.credential !== undefined ? params.credential : (config.n8nCredential || ''),
    username: params?.username !== undefined ? params.username : (config.n8nUsername || ''),
    password: params?.password !== undefined ? params.password : (config.n8nPassword || ''),
    token: params?.token !== undefined ? params.token : (config.n8nToken || '')
  };

  const res = await fetch('/api/strix/trigger-n8n', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to trigger scan via n8n webhook');
  }

  return data;
}

/**
 * Fetch and download scan output ZIP from n8n Webhook, save locally, extract, and parse all 7 files
 */
export async function fetchN8nScanResults(params) {
  const config = getStrixServerConfig();
  const payload = {
    webhookUrl: params?.webhookUrl || config.n8nFetchWebhookUrl,
    domain: params?.domain || params?.targetUrl || 'sennovate.com',
    authType: params?.authType || config.n8nAuthType || 'basic',
    credential: params?.credential !== undefined ? params.credential : (config.n8nCredential || ''),
    username: params?.username !== undefined ? params.username : (config.n8nUsername || ''),
    password: params?.password !== undefined ? params.password : (config.n8nPassword || ''),
    token: params?.token !== undefined ? params.token : (config.n8nToken || ''),
    scanStartTime: params?.scanStartTime || null,
    requireFresh: params?.requireFresh !== undefined ? params.requireFresh : false
  };

  const res = await fetch('/api/strix/fetch-n8n-results', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch scan results from n8n webhook');
  }

  return data;
}

/**
 * Diagnostic test checking whether the n8n Fetch Webhook is active and returning data
 */
export async function testN8nFetchWebhookApi(params) {
  const config = getStrixServerConfig();
  const payload = {
    webhookUrl: params?.webhookUrl || config.n8nFetchWebhookUrl,
    domain: params?.domain || 'sennovate.com',
    authType: params?.authType || config.n8nAuthType || 'basic',
    credential: params?.credential !== undefined ? params.credential : (config.n8nCredential || ''),
    username: params?.username !== undefined ? params.username : (config.n8nUsername || ''),
    password: params?.password !== undefined ? params.password : (config.n8nPassword || ''),
    token: params?.token !== undefined ? params.token : (config.n8nToken || '')
  };

  const res = await fetch('/api/strix/test-n8n-fetch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  return data;
}

/**
 * Fetch and Ingest Local Scan Output Folder on user's computer (All 7 Files Engine)
 */
export async function fetchLocalStrixFolder(folderPath) {
  const res = await fetch('/api/strix/parse-local-folder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ folderPath })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to parse local scan folder');
  }

  return data.data;
}

/**
 * List all available downloaded Strix scan folders found on user's computer
 */
export async function listLocalScanFoldersApi() {
  try {
    const res = await fetch('/api/strix/list-local-folders', {
      headers: { ...getAuthHeaders() }
    });
    if (res.ok) {
      const data = await res.json();
      return data.folders || [];
    }
  } catch (e) {
    console.warn('Note querying local scan folders:', e.message);
  }
  return [];
}

/**
 * Fetch ALL completed scan runs from Ubuntu server archive
 */
export async function fetchAllRemoteScans(customConfig) {
  const config = customConfig || getStrixServerConfig();
  const res = await fetch('/api/strix/fetch-all-runs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(config)
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch all remote scans');
  }

  return data.runs || [];
}

/**
 * Directly fetch any arbitrary file from server root via n8n
 */
export async function fetchServerFile(params) {
  const config = getStrixServerConfig();
  const payload = {
    webhookUrl: params?.webhookUrl || config.n8nFetchWebhookUrl,
    filePath: params?.filePath || params?.path || params?.domain || 'strix.log',
    path: params?.filePath || params?.path || params?.domain || 'strix.log',
    domain: params?.domain || params?.filePath || 'strix.log',
    authType: params?.authType || config.n8nAuthType || 'basic',
    credential: params?.credential !== undefined ? params.credential : (config.n8nCredential || ''),
    username: params?.username !== undefined ? params.username : (config.n8nUsername || ''),
    password: params?.password !== undefined ? params.password : (config.n8nPassword || ''),
    token: params?.token !== undefined ? params.token : (config.n8nToken || '')
  };

  const res = await fetch('/api/strix/fetch-server-file', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || 'Failed to fetch file from server');
  }

  return data;
}

/**
 * Upload and parse a scan ZIP archive from the user's laptop downloads
 */
export async function uploadScanZipApi(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64Data = e.target.result.split(',')[1];
        const res = await fetch('/api/strix/upload-scan-zip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            filename: file.name,
            base64Data
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to parse uploaded scan ZIP.');
        }
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
