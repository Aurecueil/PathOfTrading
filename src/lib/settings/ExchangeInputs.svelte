<script lang="ts">
  import CdnImage from "$lib/trade/components/item/CdnImage.svelte";
  import type { UserRatio } from "$lib/trade/tradeStore";

  let {
    arrow,
    left,
    right,
    custom,
    gridRow,
    viaIcon,
    viaName,
    onCommit,
  }: {
    arrow: string;
    left: number | null;
    right: number | null;
    custom: UserRatio | null;
    gridRow: number;
    /** icon of the proxy currency, shown in the middle of the arrow */
    viaIcon?: string | null;
    viaName?: string;
    /** (null, null) means "clear the custom ratio" */
    onCommit: (l: number | null, r: number | null) => void;
  } = $props();

  const fmt = (n: number | null) =>
    n === null ? "" : String(Number(n.toPrecision(4)));

  let lText = $state("");
  let rText = $state("");
  let focused = $state(false);

  // Keep inputs in sync with the model unless the user is typing
  $effect(() => {
    const l = fmt(left);
    const r = fmt(right);
    if (!focused) {
      lText = l;
      rText = r;
    }
  });

  function sanitize(v: string): string {
    let out = v.replace(/[^0-9.]/g, "");
    const i = out.indexOf(".");
    if (i !== -1)
      out = out.slice(0, i + 1) + out.slice(i + 1).replace(/\./g, "");
    return out;
  }

  function onInput(e: Event, side: "l" | "r") {
    const el = e.currentTarget as HTMLInputElement;
    const clean = sanitize(el.value);
    if (clean !== el.value) el.value = clean;
    if (side === "l") lText = clean;
    else rText = clean;
  }

  function commit() {
    const lt = lText.trim();
    const rt = rText.trim();
    if (lt === fmt(left) && rt === fmt(right)) return; // untouched
    if (lt === "" || rt === "") {
      onCommit(null, null); // manual deletion clears the custom ratio
      return;
    }
    const l = Number(lt);
    const r = Number(rt);
    if (!Number.isFinite(l) || !Number.isFinite(r) || l <= 0 || r <= 0) return;
    onCommit(l, r);
  }

  function handleFocusOut(e: FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && (e.currentTarget as HTMLElement).contains(next)) return;
    commit();
    focused = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    const el = e.target as HTMLInputElement;
    if (e.key === "Enter") {
      el.blur();
    } else if (e.key === "Escape") {
      e.stopPropagation(); // don't close the settings overlay
      lText = fmt(left);
      rText = fmt(right);
      el.blur();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="ex-inputs"
  class:custom={!!custom}
  role="group"
  style="grid-row: {gridRow}; grid-column: 2;"
  onfocusin={() => (focused = true)}
  onfocusout={handleFocusOut}
>
  <input
    class="ex-input"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    placeholder="-"
    aria-label="Selected currency amount"
    value={lText}
    oninput={(e) => onInput(e, "l")}
    onkeydown={handleKeydown}
  />

  <span class="ex-arrow" aria-hidden="true">
    <svg viewBox="0 0 64 12" width="64" height="12">
      {#if arrow === "←" || arrow === "↔"}
        <path d="M7 1 L1 6 L7 11" />
      {/if}
      {#if arrow === "→" || arrow === "↔"}
        <path d="M57 1 L63 6 L57 11" />
      {/if}
      {#if viaIcon}
        <path d="M1 6 H22" />
        <path d="M42 6 H63" />
      {:else}
        <path d="M1 6 H63" />
      {/if}
    </svg>
    {#if viaIcon}
      <CdnImage
        src={viaIcon}
        alt={viaName ?? "proxy"}
        className="ex-via"
        loading="lazy"
      />
    {/if}
  </span>

  <input
    class="ex-input"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    placeholder="-"
    aria-label="Other currency amount"
    value={rText}
    oninput={(e) => onInput(e, "r")}
    onkeydown={handleKeydown}
  />
</div>

<style>
  .ex-inputs {
    display: grid;
    grid-template-columns: 72px 64px 72px;
    column-gap: 3px;
    align-items: center;
    justify-content: center;
    width: max-content;
  }
  .ex-input {
    box-sizing: border-box;
    width: 72px;
    min-width: 72px;
    max-width: 72px;
    padding: 3px 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 0;
    color: inherit;
    font: inherit;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .ex-input:focus {
    outline: 1px solid rgba(255, 255, 255, 0.45);
  }
  .ex-inputs.custom .ex-input {
    border-color: #b8892f;
    color: #e9cf9f;
  }
  .ex-arrow {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    opacity: 0.9;
  }
  .ex-arrow svg {
    display: block;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ex-arrow :global(.ex-via) {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 20px;
    height: 20px;
    transform: translate(-50%, -50%);
    object-fit: contain;
  }
</style>
