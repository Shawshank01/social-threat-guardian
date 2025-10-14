import 'dotenv/config';
import path from 'node:path';

// Normalize VAPID subject to include mailto:
const subject = (process.env.VAPID_SUBJECT && process.env.VAPID_SUBJECT.startsWith('mailto:'))
  ? process.env.VAPID_SUBJECT
  : `mailto:${process.env.VAPID_SUBJECT || 'admin@example.com'}`;

function parseCorsOrigins(raw) {
  if (!raw || raw.trim() === '') return '*';
  if (raw.trim() === '*') return '*';
  const origins = raw.split(',').map(o => o.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

export const config = {
  port: process.env.PORT || 4000,
  corsOrigin: parseCorsOrigins(process.env.CORS_ORIGIN),
  // Ensure a directory is defined for file storage
  storageDir: process.env.STORAGE_DIR || './data',
  // Ensure a default filename is present
  storageFile: process.env.STORAGE_FILE || 'subscriptions.json',
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject
  }
};

// Correct argument order: first directory, then filename
export const storagePath = path.resolve(config.storageDir, config.storageFile);

if (!config.vapid.publicKey || !config.vapid.privateKey) {
  console.warn('[WARN] VAPID keys not set. Fill .env first.');
}
