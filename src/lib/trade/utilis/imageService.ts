import { invoke } from "@tauri-apps/api/core"; // In Tauri v1: import { invoke } from '@tauri-apps/api/tauri';

const CACHE_NAME = "app-cdn-images-v1";
const memoryCache = new Map<string, Promise<string>>();

/**
 * Retrieves a CDN image using Tauri IPC for network requests to bypass CORS,
 * with aggressive in-memory and on-disk caching.
 */
export async function fetchCdnImage(url: string): Promise<string> {
  if (!url) return "";

  // 1. In-memory check (deduplicates in-flight requests & rapid reads)
  if (memoryCache.has(url)) {
    return memoryCache.get(url)!;
  }

  const fetchTask = (async (): Promise<string> => {
    try {
      let cache: Cache | null = null;

      // 2. Persistent on-disk check (Cache Storage API)
      if (typeof window !== "undefined" && "caches" in window) {
        cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(url);

        if (cachedResponse) {
          const blob = await cachedResponse.blob();
          return URL.createObjectURL(blob);
        }
      }

      // 3. Fallback to Rust backend for fetch (Bypasses CORS completely)
      // 3. Fallback to Rust backend for fetch (Bypasses CORS completely)
      const rawBytes = await invoke<number[]>("fetch_image_bytes", { url });
      const uint8 = new Uint8Array(rawBytes);

      // Guess mime type from URL suffix or default to image/png
      const mimeType = url.endsWith(".webp")
        ? "image/webp"
        : url.endsWith(".jpg") || url.endsWith(".jpeg")
          ? "image/jpeg"
          : "image/png";

      // Cast as BlobPart to satisfy TypeScript's strict ArrayBuffer check
      const blob = new Blob([uint8 as BlobPart], { type: mimeType });

      // 4. Save to persistent disk cache for future sessions
      if (cache) {
        const responseToCache = new Response(blob, {
          headers: { "Content-Type": mimeType },
        });
        await cache.put(url, responseToCache);
      }

      // 5. Create local Object URL for instant HTML/Svelte rendering
      return URL.createObjectURL(blob);
    } catch (err) {
      memoryCache.delete(url);
      throw err;
    }
  })();

  memoryCache.set(url, fetchTask);
  return fetchTask;
}

/**
 * Clears memory URLs and frees browser RAM.
 */
export async function clearInMemoryCache(): Promise<void> {
  for (const [, task] of memoryCache.entries()) {
    try {
      const objectUrl = await task;
      if (objectUrl.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      // Ignore rejected promises
    }
  }
  memoryCache.clear();
}

/**
 * Wipes both RAM and persistent disk cache.
 */
export async function clearAllCaches(): Promise<boolean> {
  await clearInMemoryCache();
  if (typeof window !== "undefined" && "caches" in window) {
    return await caches.delete(CACHE_NAME);
  }
  return false;
}
