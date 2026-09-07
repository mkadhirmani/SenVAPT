import fs from 'fs';
import path from 'path';

// Synchronously load environment variables from .env before any other ES module executes
export function loadEnvFiles() {
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

loadEnvFiles();
