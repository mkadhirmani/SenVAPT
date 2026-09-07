import fs from 'fs';
import path from 'path';

// Universal WebSocket compatibility for Node.js environments (prevents @supabase/supabase-js failure in Node <= 20)
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

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Synchronously load environment variables from .env before any other ES module executes
export function loadEnvFiles() {
  const envFiles = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.resolve('.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(__dirname, '../.env')
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

  // Load persisted Supabase credentials if environment variables not set
  const confFiles = [
    path.join(process.cwd(), '.supabase_config.json'),
    path.resolve('.supabase_config.json'),
    path.resolve(__dirname, '../../.supabase_config.json')
  ];
  for (const confFile of confFiles) {
    try {
      if (fs.existsSync(confFile)) {
        const conf = JSON.parse(fs.readFileSync(confFile, 'utf-8'));
        if (conf && conf.url && conf.key) {
          if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = conf.url;
          if (!process.env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = conf.url;
          if (!process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = conf.key;
          if (!process.env.VITE_SUPABASE_ANON_KEY) process.env.VITE_SUPABASE_ANON_KEY = conf.key;
        }
      }
    } catch (_) {}
  }

  // Normalize Supabase environment variable names
  if (process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
  }
  if (process.env.VITE_SUPABASE_URL && !process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  }
  if (process.env.SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY) {
    process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  }
  if (process.env.VITE_SUPABASE_ANON_KEY && !process.env.SUPABASE_ANON_KEY) {
    process.env.SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
  }
}

loadEnvFiles();
