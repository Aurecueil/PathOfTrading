import { get, writable } from "svelte/store";
import {
  liveSoundEnabled,
  liveSoundGainDb,
  liveSoundCustomData,
} from "$lib/trade/tradeStore";

const DEFAULT_SRC = "/blip.mp3";
const MIN_GAP_MS = 120;

export const livePreviewPlaying = writable<boolean>(false);

let ctx: AudioContext | null = null;
let lastPlay = 0;
const bufferCache = new Map<string, AudioBuffer>();
const activeSources = new Set<AudioBufferSourceNode>();
const previewSources = new Set<AudioBufferSourceNode>();

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function loadBuffer(src: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(src);
  if (cached) return cached;

  const arr = src.startsWith("data:")
    ? dataUrlToArrayBuffer(src)
    : await (await fetch(src)).arrayBuffer();
  const buf = await getCtx().decodeAudioData(arr);

  if (bufferCache.size > 3) bufferCache.clear(); // don't hoard old custom files
  bufferCache.set(src, buf);
  return buf;
}

async function start(src: string, preview: boolean): Promise<void> {
  const c = getCtx();
  if (c.state === "suspended") await c.resume();

  const buffer = await loadBuffer(src);
  const source = c.createBufferSource();
  source.buffer = buffer;

  const gain = c.createGain();
  gain.gain.value = dbToGain(get(liveSoundGainDb));

  source.connect(gain).connect(c.destination);

  activeSources.add(source);
  if (preview) {
    previewSources.add(source);
    livePreviewPlaying.set(true);
  }
  source.onended = () => {
    activeSources.delete(source);
    previewSources.delete(source);
    source.disconnect();
    gain.disconnect();
    if (previewSources.size === 0) livePreviewPlaying.set(false);
  };
  source.start();
}

async function play(preview: boolean): Promise<void> {
  const custom = get(liveSoundCustomData);
  try {
    await start(custom || DEFAULT_SRC, preview);
  } catch (err) {
    console.warn("Live blip playback failed:", err);
    if (custom) {
      try {
        await start(DEFAULT_SRC, preview); // broken custom file -> default
      } catch (err2) {
        console.warn("Default blip playback failed:", err2);
      }
    }
  }
}

/** Called by tiles on incoming live items. */
export function playLiveBlip(): void {
  if (typeof window === "undefined" || !get(liveSoundEnabled)) return;
  const now = performance.now();
  if (now - lastPlay < MIN_GAP_MS) return;
  lastPlay = now;
  void play(false);
}

/** Settings preview: ignores the enabled flag and throttle, restarts if already playing. */
export function previewLiveBlip(): void {
  if (typeof window === "undefined") return;
  stopLiveBlips();
  void play(true);
}

export function stopLiveBlips(): void {
  for (const s of [...activeSources]) {
    try {
      s.stop();
    } catch {
      /* already stopped */
    }
  }
}
