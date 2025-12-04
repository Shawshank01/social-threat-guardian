const handleCache = new Map<string, string>();
const BSKY_BATCH_SIZE = 25; 
interface BskyProfile {
  did: string;
  handle: string;
}

export function getCachedHandle(did: string): string {
  if (!did) return "Unknown";
  if (handleCache.has(did)) return handleCache.get(did)!;
  const shortDid = did.startsWith('did:') ? did.split(':')[2]?.substring(0, 8) : did.substring(0, 8);
  return shortDid || "Unknown";
}

// Scalable way of handling this is by batching a list of DIDs and fetch their handles from Blusky API.
export async function resolveHandlesBatch(dids: string[]): Promise<Map<string, string>> {
  const uniqueDids = [...new Set(dids)].filter(did => 
    did.startsWith('did:') && !handleCache.has(did)
  );
  if (uniqueDids.length === 0) return new Map();

  // Bundle the DIDs manually to respect API limits which i set at 25 per request
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueDids.length; i += BSKY_BATCH_SIZE) {
    chunks.push(uniqueDids.slice(i, i + BSKY_BATCH_SIZE));
  }
  const results = await Promise.allSettled(
    chunks.map(chunk => fetchProfiles(chunk))
  );
  const newResolutions = new Map<string, string>();
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      result.value.forEach(profile => {
        let handle = profile.handle;
        if (!handle.endsWith('.bsky.social') && !handle.includes('.')) {
            handle += '.bsky.social';
        }
        const formatted = `@${handle}`;
        handleCache.set(profile.did, formatted);
        newResolutions.set(profile.did, formatted);
      });
    }
  });
  return newResolutions;
}
async function fetchProfiles(actors: string[]): Promise<BskyProfile[]> {
  try {
    const params = new URLSearchParams();
    actors.forEach(actor => params.append('actors', actor));
    const response = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?${params.toString()}`,
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.profiles || [];
  } catch (error) {
    console.warn("Failed to resolve batch handles", error);
    return [];
  }
}