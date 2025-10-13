import { Router } from 'express';
import { upsertSubscription, deactivateByEndpoint, listByQuery } from '../storage.js';
import { sendBulk } from '../push.service.js';

const router = Router();

/**
 * 
 * subscribe
 */
router.post('/subscribe', async (req, res) => {
  try {
    const sub = req.body;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return res.status(400).json({ message: 'Invalid subscription' });
    }
    const userAgent = req.get('user-agent');
    const tags = Array.isArray(req.body.tags) ? req.body.tags : undefined;
    const doc = await upsertSubscription(sub, { userAgent, tags });
    res.status(201).json({ endpoint: doc.endpoint });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Subscribe failed' });
  }
});

/**
 * cancel subscriptiion
 */
router.post('/unsubscribe', async (req, res) => {
  try {
    const endpoint = req.body?.endpoint || req.body?.subscription?.endpoint;
    if (!endpoint) return res.status(400).json({ message: 'endpoint required' });
    await deactivateByEndpoint(endpoint);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Unsubscribe failed' });
  }
});

/**
 * send notifications
 * body:
 *  - payload: { title, body, icon?, badge?, image?, data?, actions?, tag?, renotify? }
 *  - filter?: { tags?: string[] }
 *  - singleEndpoint?: string
 *  - options?: { TTL?: number, urgency?: 'very-low'|'low'|'normal'|'high' }
 */
router.post('/send', async (req, res) => {
  try {
    const { payload, filter, singleEndpoint, options } = req.body || {};
    if (!payload?.title && !payload?.body) {
      return res.status(400).json({ message: 'payload (title/body) required' });
    }

    const query = { isActive: true };
    if (Array.isArray(filter?.tags) && filter.tags.length) query.tags = filter.tags;
    if (singleEndpoint) query.endpoint = singleEndpoint;

    const result = await sendBulk({ query, payload, options, concurrency: 20 });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Send failed' });
  }
});

/**
 * check subscription number
 */
router.get('/stats', (req, res) => {
  const list = listByQuery({ isActive: true });
  res.json({ active: list.length });
});

router.get('/health', (_req, res) => res.json({ ok: true }));

export default router;