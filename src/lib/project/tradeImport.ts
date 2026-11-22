import { get } from "svelte/store";
import { leaguesAll } from "$lib/trade/tradeStore";
import type { League } from "$lib/types/leagues";
import type { ProjectItem } from "$lib/types/types";
import {
  workspaceState,
  createNewProject,
  openProject,
  setProjectDirty,
  showToast,
  triggerImportElementsIntoActive,
} from "$lib/project/projects.svelte";
import {
  parseTradeInput,
  decodeTradeCode,
  resolveRealmLeague,
} from "$lib/project/tradeLink";

// Leagues load async; on a cold start from a pot:// link they may not be there yet
function waitForLeagues(timeoutMs = 5000): Promise<League[]> {
  return new Promise((resolve) => {
    const cur = (get(leaguesAll) as League[]) ?? [];
    if (cur.length) return resolve(cur);
    let unsub: () => void = () => {};
    const timer = setTimeout(() => {
      unsub();
      resolve((get(leaguesAll) as League[]) ?? []);
    }, timeoutMs);
    unsub = leaguesAll.subscribe((v: League[]) => {
      if (v?.length) {
        clearTimeout(timer);
        queueMicrotask(() => unsub());
        resolve(v);
      }
    });
  });
}

export async function importFromTradeInput(raw: string): Promise<void> {
  const parsed = parseTradeInput(raw);
  const payload = await decodeTradeCode(parsed.code);
  const leagues = await waitForLeagues();
  const { realm, league } = resolveRealmLeague(parsed, leagues);

  const item = {
    x: 120,
    y: 120,
    w: 880,
    h: 760,
    realm,
    league,
    title: "",
    disabled: false,
    mode: "regular",
    currency: "chaos",
    searchOnLoad: true,
    full_payload: { ...payload, league },
  } as unknown as ProjectItem;

  // A project is open -> add as a tile there (uses the tile's own realm/league)
  if (
    workspaceState.activeProjectId &&
    triggerImportElementsIntoActive([item])
  ) {
    showToast("Imported search from trade link");
    return;
  }

  // No project open -> new project with the link's realm + league
  const created = await createNewProject({
    name: "",
    realm,
    league,
    initialItems: [item],
  });
  openProject({ id: created.id, name: created.name, realm: created.realm });
  setProjectDirty(created.id, true); // unnamed draft: prompt to save on close
}

export async function registerDeepLinks(): Promise<() => void> {
  let lastUrl = "";
  let lastAt = 0;
  const handle = (urls: string[]) => {
    for (const url of urls) {
      const now = Date.now();
      if (url === lastUrl && now - lastAt < 1500) continue; // dedupe double delivery
      lastUrl = url;
      lastAt = now;
      importFromTradeInput(url).catch((err) =>
        showToast(err instanceof Error ? err.message : "Import failed"),
      );
    }
  };
  try {
    const { onOpenUrl, getCurrent } =
      await import("@tauri-apps/plugin-deep-link");
    const initial = await getCurrent();
    if (initial?.length) handle(initial);
    return await onOpenUrl(handle);
  } catch (err) {
    console.error("Deep link setup failed:", err);
    return () => {};
  }
}
