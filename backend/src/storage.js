import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config, storagePath } from './config.js';

let inMemory = {
    // endpoint: { endpoint, keys:{p256dh,auth}, isActive, sendFailCount, lastError, tags[], userAgent, lastActiveAt }
};
let initialized = false;


async function ensureStorage() {
    await fs.mkdir(config.storageDir, { recursive: true });
    try {
      await fs.access(storagePath);
    } catch {
      await fs.writeFile(storagePath, JSON.stringify({ subscriptions: [] }, null, 2));
    }
}

export async function initStorage() {
    if (initialized) return;
    await ensureStorage();
    const raw = await fs.readFile(storagePath, 'utf-8');
    const json = JSON.parse(raw || '{"subscriptions":[]}');
    inMemory = {};
    for (const s of json.subscriptions || []) {
      inMemory[s.endpoint] = s;
    }
    initialized = true;
    console.log(`[Storage] Loaded ${Object.keys(inMemory).length} subscriptions from ${path.relative(process.cwd(), storagePath)}`);
}

async function persist() {
    const list = Object.values(inMemory);
    await fs.writeFile(storagePath, JSON.stringify({ subscriptions: list }, null, 2));
  }
  
export async function upsertSubscription(sub, meta = {}) {
    const now = new Date().toISOString();
    const old = inMemory[sub.endpoint] || {};
    inMemory[sub.endpoint] = {
      endpoint: sub.endpoint,
      keys: sub.keys,
      isActive: true,
      sendFailCount: 0,
      lastError: null,
      tags: Array.isArray(meta.tags) ? meta.tags : (old.tags || []),
      userAgent: meta.userAgent || old.userAgent || '',
      lastActiveAt: now,
      createdAt: old.createdAt || now,
      updatedAt: now
    };
    await persist();
    return inMemory[sub.endpoint];
}

  
export async function deactivateByEndpoint(endpoint) {
    const item = inMemory[endpoint];
    if (!item) return;
    item.isActive = false;
    item.updatedAt = new Date().toISOString();
    await persist();
}
  
export async function markSendResult(endpoint, { ok, error }) {
    const item = inMemory[endpoint];
    if (!item) return;
    if (ok) {
      item.sendFailCount = 0;
      item.lastError = null;
    } else {
      item.sendFailCount = (item.sendFailCount || 0) + 1;
      item.lastError = String(error || 'unknown');
    }
    item.updatedAt = new Date().toISOString();
    await persist();
}


export function listByQuery(query = {}) {
    const all = Object.values(inMemory);
    return all.filter(s => {
      if (query.isActive !== undefined && s.isActive !== query.isActive) return false;
      if (query.endpoint && s.endpoint !== query.endpoint) return false;
      if (Array.isArray(query.tags) && query.tags.length) {
        const set = new Set(s.tags || []);
        if (!query.tags.some(t => set.has(t))) return false;
      }
      return true;
    });
}