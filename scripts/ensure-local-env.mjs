/**
 * Garante .env mínimo para teste local do portal corporativo e iFlight.
 * - Se .env não existir, copia de .env.example
 * - Adiciona chaves ausentes (não sobrescreve valores já definidos)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

const ENSURE_KEYS = [
  ['VITE_CORPORATE_PORTAL_ENABLED', 'true'],
  /** Sem isto o bundle fica sem URL e o app cai em “modo teste” / abre callback local em vez do portal. */
  ['VITE_CORPORATE_PORTAL_LOGIN_URL', 'https://portal.latam.com/'],
  ['VITE_IFLIGHT_PROVIDER_ENABLED', 'true'],
];

function escapeKey(key) {
  return key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureKeys(content) {
  const lines = content.split(/\r?\n/);
  const out = [...lines];

  for (const [key, defaultVal] of ENSURE_KEYS) {
    const re = new RegExp(`^${escapeKey(key)}=`);
    const exists = out.some((line) => re.test(line.trim()));
    if (!exists) {
      if (out.length && out[out.length - 1] !== '') {
        out.push('');
      }
      out.push(`${key}=${defaultVal}`);
    }
  }

  return out.join('\n');
}

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('[ensure-local-env] Criado .env a partir de .env.example');
  } else {
    fs.writeFileSync(envPath, '', 'utf8');
    console.log('[ensure-local-env] Criado .env vazio');
  }
}

const before = fs.readFileSync(envPath, 'utf8');
const after = ensureKeys(before);
if (after !== before) {
  fs.writeFileSync(envPath, after, 'utf8');
  console.log('[ensure-local-env] Atualizado .env com chaves mínimas (apenas linhas ausentes).');
}
