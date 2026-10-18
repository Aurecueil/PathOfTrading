import { writable, get, derived } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";

/* ---------- Types ---------- */

export interface StatColorRule {
  id: string;
  name: string;
  keywords: string[];
  color: string;
}
export interface StatColorGroup {
  id: string;
  name: string;
  elements: StatColorNode[];
}
export type StatColorNode = StatColorGroup | StatColorRule;

/** What the trade parser consumes. */
export interface FlatStatColor {
  ruleId: string;
  keywords: string[];
  color: string;
}

interface ConfigBundle {
  defaults: StatColorNode[];
  disabledIds: string[];
  custom: StatColorNode[];
}

export const isGroup = (n: StatColorNode): n is StatColorGroup =>
  "elements" in n;

export const PALETTE = [
  "#7EEBEB",
  "#30EB6E",
  "#e75e3f",
  "#DA814D",
  "#AB6921",
  "#3B65A5",
  "#A09D42",
  "#C01E85",
  "#C79D93",
  "#ffff77",
  "#8888ff",
  "#CFEEA5",
  "#B2A7D6",
  "#FFFFFF",
];

/* ---------- Stores ---------- */

export const statColorCodingEnabled = writable<boolean>(true);
export const defaultNodesStore = writable<StatColorNode[]>([]);
export const disabledIdsStore = writable<string[]>([]);
export const customNodesStore = writable<StatColorNode[]>([]);
export const colorSaveError = writable<string | null>(null);

/* ---------- Flattening ---------- */

export const normKw = (k: string) => k.trim().toLowerCase();
/** Disabled-id for a single keyword of a rule. */
export const keywordKey = (ruleId: string, kw: string) =>
  `${ruleId}::${normKw(kw)}`;

export function flattenNodes(
  nodes: StatColorNode[],
  disabled: Set<string> = new Set(),
): FlatStatColor[] {
  const out: FlatStatColor[] = [];
  for (const node of nodes) {
    if (disabled.has(node.id)) continue;
    if (isGroup(node)) {
      out.push(...flattenNodes(node.elements, disabled));
    } else {
      const keywords = node.keywords
        .map(normKw)
        .filter(Boolean)
        .filter((k) => !disabled.has(keywordKey(node.id, k)));
      if (keywords.length) {
        out.push({ ruleId: node.id, keywords, color: node.color || "#ffffff" });
      }
    }
  }
  return out;
}

export const statKeywordColorsStore = derived(
  [
    statColorCodingEnabled,
    customNodesStore,
    defaultNodesStore,
    disabledIdsStore,
  ],
  ([$enabled, $custom, $defaults, $disabled]): FlatStatColor[] => {
    if (!$enabled) return [];
    const off = new Set($disabled);
    return [...flattenNodes($custom, off), ...flattenNodes($defaults, off)];
  },
);

/** Mutable mirror for non-Svelte code. NOT reactive: Svelte components must
 *  use `statKeywordColorsStore` / `statColorMatcher` instead. */
export const STAT_KEYWORD_COLORS: FlatStatColor[] = [];
statKeywordColorsStore.subscribe((list) => {
  STAT_KEYWORD_COLORS.splice(0, STAT_KEYWORD_COLORS.length, ...list);
});

/* ---------- Matching (shared by overlay text + settings preview) ---------- */

export interface StatColorMatcher {
  regex: RegExp | null;
  lookup: Map<string, { color: string; ruleId: string }>;
}
export interface ColorSegment {
  text: string;
  color?: string;
  ruleId?: string;
  keyword?: string;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildMatcher(rules: FlatStatColor[]): StatColorMatcher {
  const lookup = new Map<string, { color: string; ruleId: string }>();
  for (const r of rules) {
    for (const k of r.keywords) {
      if (!lookup.has(k)) lookup.set(k, { color: r.color, ruleId: r.ruleId }); // earlier (custom) wins
    }
  }
  if (!lookup.size) return { regex: null, lookup };
  const alt = [...lookup.keys()]
    .sort((a, b) => b.length - a.length) // longest keyword first
    .map(escapeRegExp)
    .join("|");
  return {
    regex: new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})(?![\\p{L}\\p{N}])`, "giu"),
    lookup,
  };
}

/** Compiled once per rules change; every consumer re-renders when it changes. */
export const statColorMatcher = derived(statKeywordColorsStore, buildMatcher);

export function colorize(text: string, m: StatColorMatcher): ColorSegment[] {
  if (!m.regex || !text) return [{ text }];
  const out: ColorSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(m.regex)) {
    const start = match.index ?? 0;
    const key = match[0].toLowerCase();
    const hit = m.lookup.get(key);
    if (!hit) continue;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({
      text: match[0],
      color: hit.color,
      ruleId: hit.ruleId,
      keyword: key,
    });
    last = start + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/* ---------- Tree helpers (operate on a draft, mutate in place) ---------- */

export const newId = () => crypto.randomUUID();

export const DEFAULT_RULE_NAME = "New rule";

export const createRule = (): StatColorRule => ({
  id: newId(),
  name: DEFAULT_RULE_NAME,
  color: "#7EEBEB",
  keywords: [],
});

export const createGroup = (): StatColorGroup => ({
  id: newId(),
  name: "New group",
  elements: [],
});

export function findNode(
  nodes: StatColorNode[],
  id: string,
): { list: StatColorNode[]; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.id === id) return { list: nodes, index: i };
    if (isGroup(n)) {
      const hit = findNode(n.elements, id);
      if (hit) return hit;
    }
  }
  return null;
}

export function removeNode(nodes: StatColorNode[], id: string): void {
  const hit = findNode(nodes, id);
  if (hit) hit.list.splice(hit.index, 1);
}

export function moveNode(
  nodes: StatColorNode[],
  id: string,
  dir: -1 | 1,
): void {
  const hit = findNode(nodes, id);
  if (!hit) return;
  const j = hit.index + dir;
  if (j < 0 || j >= hit.list.length) return;
  [hit.list[hit.index], hit.list[j]] = [hit.list[j], hit.list[hit.index]];
}

export function countRules(nodes: StatColorNode[]): number {
  return nodes.reduce(
    (sum, n) => sum + (isGroup(n) ? countRules(n.elements) : 1),
    0,
  );
}

/** Prunes the tree by text query (group/rule name, keyword) and/or an id allow-list. */
export function filterNodes(
  nodes: StatColorNode[],
  query: string,
  only: Record<string, true> | null = null,
): StatColorNode[] {
  const q = query.trim().toLowerCase();
  if (!q && !only) return nodes;

  const out: StatColorNode[] = [];
  for (const n of nodes) {
    if (isGroup(n)) {
      if (!only && q && n.name.toLowerCase().includes(q)) {
        out.push(n); // group name matches: keep whole subtree
        continue;
      }
      const elements = filterNodes(n.elements, query, only);
      if (elements.length) out.push({ ...n, elements });
    } else if (
      (!only || only[n.id]) &&
      (!q ||
        n.name.toLowerCase().includes(q) ||
        n.keywords.some((k) => k.toLowerCase().includes(q)))
    ) {
      out.push(n);
    }
  }
  return out;
}

/* ---------- Cross-window sync ---------- */

const instanceId = newId();
let syncListenerInitialized = false;

export async function ensureCrossWindowSync(): Promise<void> {
  if (syncListenerInitialized || typeof window === "undefined") return;
  syncListenerInitialized = true;

  try {
    await listen<{ source?: string }>("stat-colors-updated", async (event) => {
      if (event.payload?.source === instanceId) return; // ignore own echo
      await loadStatColorConfigsFromDisk(false);
    });
    await listen<{ enabled: boolean }>("color-coding-toggled", (event) => {
      if (typeof event.payload?.enabled === "boolean") {
        statColorCodingEnabled.set(event.payload.enabled);
      }
    });
  } catch {
    // Non-Tauri fallback
  }
}

const notifyUpdated = () =>
  emit("stat-colors-updated", { source: instanceId }).catch(() => {});

/* ---------- Load / save ---------- */

export async function loadStatColorConfigsFromDisk(
  setupListener = true,
): Promise<void> {
  if (setupListener) await ensureCrossWindowSync();

  try {
    const bundle = await invoke<ConfigBundle>("get_stat_color_configs");
    defaultNodesStore.set(bundle.defaults ?? []);
    disabledIdsStore.set(bundle.disabledIds ?? []);
    customNodesStore.set(bundle.custom ?? []);
    history.length = 0;
    canUndoCustom.set(false);
    colorSaveError.set(null);
  } catch (err) {
    console.error("Failed to load stat color configs:", err);
    colorSaveError.set(`Failed to load color rules: ${err}`);
  }
}

/** Defaults: toggle a group, rule, or keyword (`keywordKey`) id on/off. */
export async function toggleDefault(id: string): Promise<void> {
  const current = get(disabledIdsStore);
  const next = current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id];
  await saveDisabled(next);
}

export const resetDefaultToggles = () => saveDisabled([]);

async function saveDisabled(ids: string[]): Promise<void> {
  disabledIdsStore.set(ids); // UI + matcher update instantly
  try {
    await invoke("save_disabled_default_stat_colors", { disabledIds: ids });
    colorSaveError.set(null);
    await notifyUpdated();
  } catch (err) {
    colorSaveError.set(`Failed to save default toggles: ${err}`);
  }
}

/* ---------- Custom rules: mutate, undo, debounced save ---------- */

const history: StatColorNode[][] = [];
let lastKey: string | undefined;
let lastAt = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
export const canUndoCustom = writable(false);

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void persistCustom();
  }, 200);
}

/** `coalesce`: edits with the same key within 800ms share one undo step (color drags, typing). */
export function mutateCustom(
  fn: (draft: StatColorNode[]) => void,
  coalesce?: string,
): void {
  const current = get(customNodesStore);
  const now = Date.now();
  if (!(coalesce && coalesce === lastKey && now - lastAt < 800)) {
    history.push(structuredClone(current));
    if (history.length > 50) history.shift();
  }
  lastKey = coalesce;
  lastAt = now;

  const draft = structuredClone(current);
  fn(draft);
  customNodesStore.set(draft);
  canUndoCustom.set(true);
  scheduleSave();
}

export function undoCustom(): boolean {
  const prev = history.pop();
  if (!prev) return false;
  lastKey = undefined;
  customNodesStore.set(prev);
  canUndoCustom.set(history.length > 0);
  scheduleSave();
  return true;
}

/** Copies a (default) rule to the top of the custom list. Returns the new id. */
export function copyRuleToCustom(rule: StatColorRule): string {
  const copy: StatColorRule = {
    id: newId(),
    name: rule.name,
    color: rule.color,
    keywords: [...rule.keywords],
  };
  mutateCustom((d) => d.unshift(copy));
  return copy.id;
}

async function persistCustom(): Promise<void> {
  try {
    await invoke("save_custom_stat_colors", { custom: get(customNodesStore) });
    colorSaveError.set(null);
    await notifyUpdated();
  } catch (err) {
    colorSaveError.set(`Failed to save custom rules: ${err}`);
  }
}

/** Call when leaving the settings view so a pending debounce isn't lost. */
export async function flushCustomSave(): Promise<void> {
  if (saveTimer === undefined) return;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  await persistCustom();
}

export async function setStatColorCodingEnabled(
  enabled: boolean,
): Promise<void> {
  statColorCodingEnabled.set(enabled);
  await invoke("set_color_coding", { enabled });
  await emit("color-coding-toggled", { enabled }).catch(() => {});
}
