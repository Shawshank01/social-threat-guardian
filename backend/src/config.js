import 'dotenv/config';

export const config = {
    port: process.env.PORT || 4000,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    storageFile: 'subscriptions.json',
    vapid: {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
        subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
      }
};

[mongoUri, vapid].forEach((k) => {
    if (!config.vapid.privateKey || !config.vapid.publicKey) {
        console.warn('[WARN] VAPID keys not set')
    }
});