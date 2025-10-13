import webpush from 'web-push';
import { config } from './config.js';
import { listByQuery, markSendResult, deactivateByEndpoint } from './storage.js';

webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);

export async function sendToOneDoc(doc, payload, options = { TTL: 3600, urgency: 'normal' }) {
  try {
    await webpush.sendNotification(
      { endpoint: doc.endpoint, keys: doc.keys },
      JSON.stringify(payload),
      options
    );
    await markSendResult(doc.endpoint, { ok: true });
    return { ok: true };
  } catch (err) {
    const status = err?.statusCode;
    const isGone = status === 404 || status === 410;
    if (isGone) {
      await deactivateByEndpoint(doc.endpoint);
    }
    await markSendResult(doc.endpoint, { ok: false, error: err?.message || String(err) });
    return { ok: false, error: err?.message || String(err), status };
  }
}

export async function sendBulk({ query = { isActive: true }, payload, options, concurrency = 20 }) {
  const targets = listByQuery(query);
  const results = [];
  const pool = new Set();

  async function run(doc) {
    const res = await sendToOneDoc(doc, payload, options);
    results.push({ endpoint: doc.endpoint, ...res });
  }

  for (const doc of targets) {
    const p = run(doc).finally(() => pool.delete(p));
    pool.add(p);
    if (pool.size >= concurrency) await Promise.race(pool);
  }
  await Promise.all(pool);

  return {
    summary: {
      total: results.length,
      success: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length
    },
    results
  };
}
