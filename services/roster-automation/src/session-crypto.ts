/**
 * Cifra / decifra o Playwright storageState (cookies de sessão) com AES-256-GCM.
 * A chave vem de SESSION_ENCRYPTION_KEY (64 hex = 32 bytes).
 * Cookies nunca são escritos em texto claro — nem em disco, nem em logs.
 */
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGO = 'aes-256-gcm' as const;

interface EncryptedBlob {
  iv: string;
  tag: string;
  data: string;
}

export function encryptSession(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const blob: EncryptedBlob = {
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: encrypted.toString('hex'),
  };
  return JSON.stringify(blob);
}

export function decryptSession(encryptedJson: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const { iv, tag, data } = JSON.parse(encryptedJson) as EncryptedBlob;
  const decipher = createDecipheriv(ALGO, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
