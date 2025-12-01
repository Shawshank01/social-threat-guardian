export async function resolveHandle(didOrHandle: string): Promise<string> {
 if (!didOrHandle) return "Unknown";
 if (!didOrHandle.startsWith("did:")) {
 return didOrHandle.startsWith("@") ? didOrHandle : `@${didOrHandle}`;
 }
 try {
 const response = await fetch(
 `https://public.api.bsky.app/xrpc/com.atproto.repo.describeRepo?repo=${didOrHandle}`,
 { method: 'GET', headers: { 'Accept': 'application/json' } }
 );
 if (!response.ok) {
 throw new Error(`Resolution failed: ${response.status}`);
 }
 const data = await response.json();
 if (data.handle) {
 return `@${data.handle}`;
 }
 } catch (err) {
 }
 return `@${didOrHandle.substring(0, 12)}...`;
}
export function extractIdentityFromUrl(url: string): string | null {
 try {
 const match = url.match(/profile\/([^/]+)/);
 return match ? match[1] : null;
 } catch (e) {
 return null;
 }
}