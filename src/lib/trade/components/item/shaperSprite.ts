// src/lib/trade/components/item/shaperSprite.ts
import { fetchCdnImage } from "$lib/trade/utilis/imageService";

const CDN_BASE = "https://web.poecdn.com";
const SCROLLING_SHAPER_SHEET_URL = "/ScrollingShaperBackground.png";

export interface ExtractedSpriteResult {
  src: string;
  width: number;
  height: number;
}

const extractedCache = new Map<string, ExtractedSpriteResult>();
const pendingExtractCache = new Map<
  string,
  Promise<ExtractedSpriteResult | null>
>();

const alphaMaskCache = new Map<string, ImageBitmap>();
const pendingAlphaMaskCache = new Map<string, Promise<ImageBitmap | null>>();

let scrollingSheetPromise: Promise<HTMLImageElement> | null = null;

export function normalizeCdnUrl(raw: string): string {
  const url = raw.trim().replace(/\\\//g, "/");
  if (/^(https?:)?\/\//i.test(url) || /^(blob|data):/i.test(url)) {
    return url.startsWith("//") ? `https:${url}` : url;
  }
  return `${CDN_BASE}/${url.replace(/^\/+/, "")}`;
}

export function getShaperBgUrl(w: number, h: number, x = 0, y = 0): string {
  return `${CDN_BASE}/image/inventory/ShaperBackground.png?w=${w}&h=${h}&x=${x}&y=${y}`;
}

export function getElderBgUrl(w: number, h: number): string {
  return `${CDN_BASE}/image/inventory/ElderBackground.png?w=${w}&h=${h}`;
}

/**
 * Loads `/static/ScrollingShaperBackground.png` (595x690) once and shares it across all instances.
 */
export function loadScrollingShaperSheet(): Promise<HTMLImageElement> {
  if (!scrollingSheetPromise) {
    scrollingSheetPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => {
        scrollingSheetPromise = null;
        reject(e);
      };
      img.src = SCROLLING_SHAPER_SHEET_URL;
    });
  }
  return scrollingSheetPromise;
}

/**
 * Loads a CDN image via `fetchCdnImage` (respecting RAM + CacheStorage disk cache)
 * and decodes the same-origin `blob:` URL into an `ImageBitmap`.
 */
async function loadCachedBitmap(rawUrl: string): Promise<ImageBitmap> {
  const url = normalizeCdnUrl(rawUrl);
  const blobUrl = await fetchCdnImage(url);
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return await createImageBitmap(blob);
}

/**
 * Pulls `ShaperBackground.png?w={w}&h={h}&x=0&y=0` once from CDN (via cache)
 * and extracts an alpha-only mask bitmap for cutting out the scrolling shaper fragment.
 */
export async function getShaperAlphaMask(
  w: number,
  h: number,
): Promise<ImageBitmap | null> {
  const key = `${w}x${h}`;
  const cached = alphaMaskCache.get(key);
  if (cached) return cached;

  const pending = pendingAlphaMaskCache.get(key);
  if (pending) return pending;

  const task = (async (): Promise<ImageBitmap | null> => {
    try {
      const bmp = await loadCachedBitmap(getShaperBgUrl(w, h, 0, 0));
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0);
      bmp.close();

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = imgData.data;
      // Keep alpha channel intact; normalize RGB to white for clean destination-in masking
      for (let i = 0; i < px.length; i += 4) {
        px[i] = 255;
        px[i + 1] = 255;
        px[i + 2] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      const maskBmp = await createImageBitmap(canvas);
      alphaMaskCache.set(key, maskBmp);
      return maskBmp;
    } catch (err) {
      console.error("Failed to build Shaper alpha mask:", err);
      return null;
    } finally {
      pendingAlphaMaskCache.delete(key);
    }
  })();

  pendingAlphaMaskCache.set(key, task);
  return task;
}

/**
 * 4-connected component labeling matching scipy.ndimage.label(alpha > 15).
 * Removes isolated islands smaller than `minSize` pixels.
 */
function removeSmallIslands(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 15,
  minSize = 27,
): void {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);

  for (let i = 0; i < total; i++) {
    if (visited[i] || alpha[i] <= threshold) continue;

    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    visited[i] = 1;

    while (head < tail) {
      const idx = queue[head++];
      const x = idx % width;
      const y = (idx - x) / width;

      if (x > 0) {
        const n = idx - 1;
        if (!visited[n] && alpha[n] > threshold) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (x + 1 < width) {
        const n = idx + 1;
        if (!visited[n] && alpha[n] > threshold) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (y > 0) {
        const n = idx - width;
        if (!visited[n] && alpha[n] > threshold) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (y + 1 < height) {
        const n = idx + width;
        if (!visited[n] && alpha[n] > threshold) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
    }

    if (tail < minSize) {
      for (let k = 0; k < tail; k++) {
        alpha[queue[k]] = 0;
      }
    }
  }
}

/**
 * Separable Gaussian blur approximating PIL ImageFilter.GaussianBlur(radius).
 */
function blurAlpha(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  const half = Math.max(1, Math.ceil(radius * 2));
  const kernelSize = half * 2 + 1;
  const kernel = new Float32Array(kernelSize);
  const twoSigmaSq = 2 * radius * radius;

  let sum = 0;
  for (let i = -half; i <= half; i++) {
    const val = Math.exp(-(i * i) / twoSigmaSq);
    kernel[i + half] = val;
    sum += val;
  }
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }

  const temp = new Float32Array(width * height);
  const out = new Uint8ClampedArray(width * height);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -half; k <= half; k++) {
        const sx = Math.min(width - 1, Math.max(0, x + k));
        acc += alpha[row + sx] * kernel[k + half];
      }
      temp[row + x] = acc;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    const yc = y * width;
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -half; k <= half; k++) {
        const sy = Math.min(height - 1, Math.max(0, y + k));
        acc += temp[sy * width + x] * kernel[k + half];
      }
      out[yc + x] = Math.round(acc);
    }
  }

  return out;
}

function drawResizedToData(
  bmp: ImageBitmap,
  width: number,
  height: number,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Extracts foreground sprite by subtracting either:
 * - Shaper only (`isElder = false`): low=12, high=37, minSize=27, blur=0.5
 * - Elder over Shaper (`isElder = true`): Porter-Duff composite of Elder (bg1) over Shaper (bg2),
 *   low=20, high=178, minSize=34, blur=1.0, plus edge color unmixing.
 */
export async function extractInfluenceSprite(
  iconUrl: string,
  w: number,
  h: number,
  isElder: boolean,
): Promise<ExtractedSpriteResult | null> {
  const normalizedIcon = normalizeCdnUrl(iconUrl);
  const modeKey = isElder ? "shaper+elder" : "shaper";
  const cacheKey = `${modeKey}|${normalizedIcon}|${w}x${h}`;

  const cached = extractedCache.get(cacheKey);
  if (cached) return cached;

  const pending = pendingExtractCache.get(cacheKey);
  if (pending) return pending;

  const task = (async (): Promise<ExtractedSpriteResult | null> => {
    try {
      const shaperBgUrl = getShaperBgUrl(w, h, 0, 0);
      const [fgBmp, shaperBmp, elderBmp] = await Promise.all([
        loadCachedBitmap(normalizedIcon),
        loadCachedBitmap(shaperBgUrl),
        isElder ? loadCachedBitmap(getElderBgUrl(w, h)) : Promise.resolve(null),
      ]);

      const width = fgBmp.width;
      const height = fgBmp.height;
      if (!width || !height) {
        fgBmp.close();
        shaperBmp.close();
        elderBmp?.close();
        return null;
      }

      const fgData = drawResizedToData(fgBmp, width, height);
      const shaperData = drawResizedToData(shaperBmp, width, height);
      const elderData = elderBmp
        ? drawResizedToData(elderBmp, width, height)
        : null;

      fgBmp.close();
      shaperBmp.close();
      elderBmp?.close();

      const fgPx = fgData.data;
      const shaperPx = shaperData.data;
      const elderPx = elderData?.data ?? null;
      const pixelCount = width * height;

      // Build reference background RGBA array (compBg)
      const compBg = new Float32Array(pixelCount * 4);
      if (isElder && elderPx) {
        // Porter-Duff Source-Over: BG1 (Elder top overlay) over BG2 (Shaper bottom base)
        for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
          const a1 = elderPx[p + 3] / 255.0;
          const a2 = shaperPx[p + 3] / 255.0;
          const outA = a1 + a2 * (1.0 - a1);
          const safeOutA = outA > 1e-6 ? outA : 1.0;

          compBg[p] =
            (elderPx[p] * a1 + shaperPx[p] * a2 * (1.0 - a1)) / safeOutA;
          compBg[p + 1] =
            (elderPx[p + 1] * a1 + shaperPx[p + 1] * a2 * (1.0 - a1)) /
            safeOutA;
          compBg[p + 2] =
            (elderPx[p + 2] * a1 + shaperPx[p + 2] * a2 * (1.0 - a1)) /
            safeOutA;
          compBg[p + 3] = outA * 255.0;
        }
      } else {
        for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
          compBg[p] = shaperPx[p];
          compBg[p + 1] = shaperPx[p + 1];
          compBg[p + 2] = shaperPx[p + 2];
          compBg[p + 3] = shaperPx[p + 3];
        }
      }

      const lowThresh = isElder ? 20.0 : 12.0;
      const highThresh = isElder ? 178.0 : 37.0;
      const minSize = isElder ? 34 : 27;
      const blurRadius = isElder ? 1.0 : 0.5;
      const range = highThresh - lowThresh;

      const alpha = new Uint8ClampedArray(pixelCount);

      for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
        const dr = fgPx[p] - compBg[p];
        const dg = fgPx[p + 1] - compBg[p + 1];
        const db = fgPx[p + 2] - compBg[p + 2];

        const diff =
          Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db) *
          1.732;

        let a = ((diff - lowThresh) / range) * 255.0;
        if (a < 0) a = 0;
        else if (a > 255) a = 255;

        const origAlpha = fgPx[p + 3];
        alpha[i] = a < origAlpha ? a : origAlpha;
      }

      removeSmallIslands(alpha, width, height, 15, minSize);
      const smoothed = blurAlpha(alpha, width, height, blurRadius);

      const outCanvas = document.createElement("canvas");
      outCanvas.width = width;
      outCanvas.height = height;
      const outCtx = outCanvas.getContext("2d")!;
      const outData = outCtx.createImageData(width, height);
      const outPx = outData.data;

      for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
        const a = smoothed[i];

        if (isElder && a > 0 && a < 245 && compBg[p + 3] > 200) {
          // Unmix composite background color from semi-transparent edge pixels
          const aNorm = Math.min(1.0, Math.max(0.2, a / 255.0));
          const inv = 1.0 - aNorm;
          outPx[p] = Math.min(
            255,
            Math.max(0, Math.round((fgPx[p] - inv * compBg[p]) / aNorm)),
          );
          outPx[p + 1] = Math.min(
            255,
            Math.max(
              0,
              Math.round((fgPx[p + 1] - inv * compBg[p + 1]) / aNorm),
            ),
          );
          outPx[p + 2] = Math.min(
            255,
            Math.max(
              0,
              Math.round((fgPx[p + 2] - inv * compBg[p + 2]) / aNorm),
            ),
          );
        } else {
          outPx[p] = fgPx[p];
          outPx[p + 1] = fgPx[p + 1];
          outPx[p + 2] = fgPx[p + 2];
        }

        outPx[p + 3] = a;
      }

      outCtx.putImageData(outData, 0, 0);

      const outBlob = await new Promise<Blob | null>((resolve) =>
        outCanvas.toBlob(resolve, "image/png"),
      );
      const src = outBlob
        ? URL.createObjectURL(outBlob)
        : outCanvas.toDataURL("image/png");

      const result: ExtractedSpriteResult = { src, width, height };
      extractedCache.set(cacheKey, result);
      return result;
    } catch (err) {
      console.error("Influence sprite extraction failed:", err);
      return null;
    } finally {
      pendingExtractCache.delete(cacheKey);
    }
  })();

  pendingExtractCache.set(cacheKey, task);
  return task;
}
