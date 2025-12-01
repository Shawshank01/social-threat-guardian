const handleCache = new Map<string, string>();
const requestQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;
const maxConcurrent = 3;
let activeRequests = 0;
 const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
 const processQueue = async () => {
 if (isProcessingQueue) return;
 isProcessingQueue = true;
 while (requestQueue.length > 0) {
 if (activeRequests >= maxConcurrent) {
 await wait(25);
 continue;
 }
 const task = requestQueue.shift();
 if (task) {
 activeRequests++;
 task().finally(() => activeRequests--);
 await wait(40);
 }
 }
 isProcessingQueue = false;
};
 const fetchJson = async (url: string) => {
 try {
 const res = await fetch(url, { headers: { Accept: "application/json" } });
 if (!res.ok) return null;
 return await res.json();
 } catch {
 return null;
 }
};
 export async function resolveHandle(id: string): Promise<string> {
 if (!id) return "Unknown";
 const clean = id.startsWith("@") ? id.slice(1) : id;
 if (handleCache.has(clean)) return handleCache.get(clean)!;
 const fallback = `@${clean.substring(0, 12)}...`;
 if (clean.startsWith("did:")) {
 return new Promise<string>((resolve) => {
 const job = async () => {
 const d1 = await fetchJson(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?did=${encodeURIComponent(clean)}`);
 if (d1?.handle) {
 const h = `@${d1.handle}`;
 handleCache.set(clean, h);
 resolve(h);
 return;
 }
 const d2 = await fetchJson(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(clean)}`);
 if (d2?.handle) {
 const h = `@${d2.handle}`;
 handleCache.set(clean, h);
 resolve(h);
 return;
 }
 const d3 = await fetchJson(`https://plc.directory/${encodeURIComponent(clean)}`);
 if (d3?.alsoKnownAs) {
 for (const a of d3.alsoKnownAs) {
 if (a.startsWith("at://")) {
 const h = `@${a.slice(5)}`;
 handleCache.set(clean, h);
 resolve(h);
 return;
 }
 }
 }
 handleCache.set(clean, fallback);
 resolve(fallback);
 };
 requestQueue.push(job);
 processQueue();
 });
 }
 return id.startsWith("@") ? id : `@${id}`;
}
 export function extractIdentityFromUrl(url: string): string | null {
 try {
 const m = url.match(/profile\/([^/]+)/);
 return m ? m[1] : null;
 } catch {
 return null;
 }
}
