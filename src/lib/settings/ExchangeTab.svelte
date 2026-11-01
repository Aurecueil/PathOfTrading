<script lang="ts">
  import { onMount } from "svelte";
  import ExchangeRow from "$lib/settings/ExchangeRow.svelte";
  import type { StaticEntry } from "$lib/types/statics";
  import {
    preferDirectExchange,
    tadedExchangeRatios,
    rawPrices,
    userRatios,
    leaguesAll,
    staticsPoe,
    staticsPoe2,
    getValidLeagues,
    ratioModeFor,
    getSourceRowMultiplier,
    setUserMultiplier,
    clearUserMultiplier,
    setUserLifetime,
    POE1_TARGETS,
    POE2_TARGETS,
    type PairSource,
    type LifetimeId,
    type UserRatio,
  } from "$lib/trade/tradeStore";
  import type { Realm, League } from "$lib/types/leagues";
  import ComboSelect from "$lib/settings/ComboSelect.svelte";

  type RowModel = {
    id: string;
    source: PairSource;
    dir: "both" | "fwd" | "back";
    arrow: string;
    from: string;
    to: string;
    left: number | null;
    right: number | null;
    custom: UserRatio | null;
    age: string;
    viaIcon?: string | null;
    viaName?: string;
  };
  type BlockModel = {
    id: string;
    other: string;
    rows: RowModel[];
  };

  const REALMS: { id: Realm; label: string }[] = [
    { id: "pc", label: "Path of Exile" },
    { id: "xbox", label: "PoE (xbox)" },
    { id: "sony", label: "PoE (sony)" },
    { id: "poe2", label: "Path of Exile 2" },
  ];

  let realm = $state<Realm>("pc");
  let leagueSel = $state("");
  let currencySel = $state("chaos");
  let now = $state(Date.now());

  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(t);
  });

  // const leagues = $derived(realm === "poe2" ? $leaguesPoe2 : $leaguesPoe);
  const leagues = $derived(
    ($leaguesAll || []).filter((l: League) => l.realm === realm),
  );
  const statics = $derived(realm === "poe2" ? $staticsPoe2 : $staticsPoe);

  // Leagues come from the league stores; price files are optional
  const leagueIds = $derived.by(() => {
    const ids = getValidLeagues(leagues, realm).map((l) => l.id);
    const extra = Object.keys($rawPrices[realm] ?? {}).filter(
      (id) => !ids.includes(id),
    );
    return [...ids, ...extra];
  });
  const league = $derived(
    leagueIds.includes(leagueSel) ? leagueSel : (leagueIds[0] ?? ""),
  );

  const currencies = $derived<string[]>(
    realm === "poe2" ? [...POE2_TARGETS] : [...POE1_TARGETS],
  );
  const currency = $derived(
    currencies.includes(currencySel)
      ? currencySel
      : currencies.includes("chaos")
        ? "chaos"
        : currencies[0],
  );

  const maps = $derived(league ? $rawPrices[realm]?.[league] : undefined);
  const userPairs = $derived(league ? $userRatios[realm]?.[league] : undefined);

  function findStatic(id: string): StaticEntry | undefined {
    for (const cat of statics ?? []) {
      const hit = cat.entries?.find((e) => e.id === id);
      if (hit) return hit;
    }
    return undefined;
  }
  const nameOf = (id: string) => findStatic(id)?.text ?? id;

  /** Scale so the more expensive currency is shown as exactly 1. */
  function normalize(l: number, r: number) {
    return l <= r ? { l: 1, r: r / l } : { l: l / r, r: 1 };
  }

  function formatAge(ts: number | null | undefined, nowMs: number): string {
    if (!ts) return "";
    const ms = ts < 1e12 ? ts * 1000 : ts;
    const m = Math.floor(Math.max(0, nowMs - ms) / 60_000);
    if (m < 120) return ""; // fresh enough (hourly refresh), don't show
    const h = Math.floor(m / 60);
    if (h < 48) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const blocks = $derived.by((): BlockModel[] => {
    if (!currency) return [];
    const traded = $tadedExchangeRatios;
    const preferDirect = $preferDirectExchange;
    const out: BlockModel[] = [];

    for (const other of currencies) {
      if (other === currency) continue;
      const { key } = ratioModeFor(currency, other, traded);

      const hasD = !!maps?.direct[key];
      const hasP = !!maps?.proxy[key];
      // both -> the preferred one; only one -> that one; none -> "-" placeholder
      const source: PairSource =
        hasD && hasP
          ? preferDirect
            ? "direct"
            : "proxy"
          : hasP
            ? "proxy"
            : "direct";

      const dirs: ("both" | "fwd" | "back")[] = traded
        ? ["both"]
        : ["fwd", "back"];

      const via = source === "proxy" ? maps?.proxy[key]?.via : undefined;
      const viaEntry = via ? findStatic(via) : undefined;

      const rows: RowModel[] = dirs.map((dir): RowModel => {
        const [from, to] =
          dir === "back" ? [other, currency] : [currency, other];
        const r = getSourceRowMultiplier(
          maps,
          userPairs,
          source,
          from,
          to,
          traded,
        );
        let left: number | null = null;
        let right: number | null = null;
        if (r.mult !== null && r.mult > 0) {
          const n =
            dir === "back" ? normalize(r.mult, 1) : normalize(1, r.mult);
          left = n.l;
          right = n.r;
        }
        return {
          id: `${other}|${source}|${dir}`,
          source,
          dir,
          arrow: dir === "both" ? "↔" : dir === "fwd" ? "→" : "←",
          from,
          to,
          left,
          right,
          custom: r.custom,
          age: r.entry
            ? formatAge(r.entry.timestamp ?? maps?.timestamp, now)
            : "",
          viaIcon: viaEntry?.image,
          viaName: viaEntry?.text ?? via,
        };
      });

      out.push({ id: other, other, rows });
    }
    return out;
  });

  function findRow(b: BlockModel, rowId: string): RowModel | undefined {
    return b.rows.find((r) => r.id === rowId);
  }

  function commit(
    b: BlockModel,
    rowId: string,
    l: number | null,
    r: number | null,
  ) {
    const row = findRow(b, rowId);
    if (!row || !league) return;
    const traded = $tadedExchangeRatios;
    if (l === null || r === null) {
      clearUserMultiplier(realm, league, row.from, row.to, traded);
      return;
    }
    // l = selected currency amount, r = other currency amount
    const mult = row.dir === "back" ? l / r : r / l; // "1 from = mult to"
    setUserMultiplier(realm, league, row.from, row.to, mult, traded);
  }

  function changeLifetime(b: BlockModel, rowId: string, id: LifetimeId) {
    const row = findRow(b, rowId);
    if (!row || !league) return;
    setUserLifetime(realm, league, row.from, row.to, $tadedExchangeRatios, id);
  }

  const selectedEntry = $derived(currency ? findStatic(currency) : undefined);
  const realmOptions = $derived(
    REALMS.map((r) => ({ id: r.id, name: r.label })),
  );
  const leagueOptions = $derived(leagueIds.map((id) => ({ id, name: id })));
  const currencyOptions = $derived(
    currencies.map((c) => ({
      id: c,
      name: nameOf(c),
      image: findStatic(c)?.image,
    })),
  );
</script>

<label class="pb-check">
  <input type="checkbox" bind:checked={$preferDirectExchange} />
  <span class="pb-box"></span>
  <span class="pb-check-text"
    >Prefer direct exchange data over proxy exchange</span
  >
</label>

<label class="pb-check">
  <input type="checkbox" bind:checked={$tadedExchangeRatios} />
  <span class="pb-box"></span>
  <span class="pb-check-text">Use ratios based on traded volume</span>
</label>

<div class="ex-selectors">
  <div class="ex-field">
    <label class="pb-check-text" for="ex-game">Game</label>
    <ComboSelect
      id="ex-game"
      options={realmOptions}
      value={realm}
      minWidth={150}
      onSelect={(r) => (realm = r as Realm)}
    />
  </div>

  <div class="ex-field">
    <label class="pb-check-text" for="ex-league">League</label>
    <ComboSelect
      id="ex-league"
      options={leagueOptions}
      value={league}
      disabled={leagueIds.length === 0}
      minWidth={150}
      onSelect={(l) => (leagueSel = l)}
    />
  </div>

  <div class="ex-field">
    <label class="pb-check-text" for="ex-currency">Currency</label>
    <ComboSelect
      id="ex-currency"
      options={currencyOptions}
      value={currency}
      minWidth={160}
      onSelect={(c) => (currencySel = c)}
    />
  </div>
</div>

{#if !maps}
  <p class="ex-empty">
    No market data loaded for this league. Values show "-" but you can still set
    your own.
  </p>
{/if}

<div class="ex-list">
  {#each blocks as b (b.id)}
    {@const otherEntry = findStatic(b.other)}
    <div class="ex-block">
      <ExchangeRow
        leftIcon={selectedEntry?.image}
        leftName={selectedEntry?.text ?? currency}
        rightIcon={otherEntry?.image}
        rightName={otherEntry?.text ?? b.other}
        rows={b.rows}
        onCommit={(id, l, r) => commit(b, id, l, r)}
        onLifetime={(id, lt) => changeLifetime(b, id, lt)}
      />
    </div>
  {/each}
</div>

<style>
  .ex-selectors {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 20px;
    margin: 12px 0;
  }
  .ex-field {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ex-list {
    display: flex;
    flex-direction: column;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }
  .ex-block {
    padding: 6px 0;
    border: none;
    background: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }
  .ex-empty {
    opacity: 0.6;
    font-size: 12px;
    margin: 0 0 10px;
  }
  .ex-block:last-child {
    border-bottom: none;
  }
</style>
