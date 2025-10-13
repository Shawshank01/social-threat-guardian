import 'dotenv/config';
import path from 'node:path';

export const config = {
    port: process.env.PORT || 4000,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    storageFile: 'subscriptions.json',
    vapid: {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
        subject: process.env.VAPID_SUBJECT || 'mindezhou1@outlook.com'
      }
};

export const storagePath = path.resolve(config.storageFile, config.storageDir);

if (!config.vapid.publicKey || !config.vapid.privateKey) {
    console.warn('[WARN] VAPID keys not set. Fill .env first.');
  }