import { invoke } from "@tauri-apps/api/core"; // In Tauri v1: import { invoke } from '@tauri-apps/api/tauri';

const CACHE_NAME = "app-cdn-images-v1";
const memoryCache = new Map<string, Promise<string>>();

// e.g., src/lib/utils/imageCache.ts (or wherever fetchCdnImage is located)

export interface CacheSummary {
  count: number;
  sizeBytes: number;
  formattedSize: string;
}

export async function getCacheStats(): Promise<CacheSummary> {
  let count = 0;
  let sizeBytes = 0;

  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const hasCache = await caches.has(CACHE_NAME);
      if (hasCache) {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        count = requests.length;

        const sizes = await Promise.all(
          requests.map(async (req) => {
            const res = await cache.match(req);
            if (!res) return 0;
            const blob = await res.blob();
            return blob.size;
          }),
        );
        sizeBytes = sizes.reduce((acc, b) => acc + b, 0);
      }
    } catch (err) {
      console.error("Failed to read image cache stats:", err);
    }
  }

  return {
    count,
    sizeBytes,
    formattedSize: formatBytes(sizeBytes),
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
}
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
