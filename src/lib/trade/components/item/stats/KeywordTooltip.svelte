<!-- src/lib/trade/components/item/stats/KeywordTooltip.svelte -->
<script lang="ts">
  import KeywordText from "./KeywordText.svelte";
  import { cleanBracketText } from "./statsUtils";
  import { getContext } from "svelte";

  export let term: string = "";
  export let definition: string = "";
  export let x: number = 0;
  export let y: number = 0;
  export let depth: number = 0;
  export let pinned: boolean = false;

  const TIP_W = 360;
  const OFFSET = 14;
  const PAD = 8;

  let tipW = TIP_W;
  let tipH = 0;

  // Preserve bracketed keywords in paragraphs so KeywordText can parse them
  $: paragraphs = definition
    ? definition
        .replace(/\r\n/g, "\n")
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  function measureTip(node: HTMLElement) {
    const update = () => {
      tipW = node.offsetWidth || TIP_W;
      tipH = node.offsetHeight || 0;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return {
      destroy() {
        ro.disconnect();
      },
    };
  }

  const canvas = getContext<{ getWorld: () => HTMLElement | null } | undefined>(
    "canvasWorld",
  );

  // Convert a client (screen) point into world coordinates, plus the visible
  // world-space bounds of the viewport so we can clamp inside it.
  function toWorldSpace(cx: number, cy: number) {
    const world = canvas?.getWorld();
    const vp = world?.parentElement;
    if (!world || !vp) {
      // Not inside a canvas: fall back to plain screen space
      return {
        x: cx,
        y: cy,
        minX: 0,
        minY: 0,
        maxX: window.innerWidth,
        maxY: window.innerHeight,
      };
    }
    const wr = world.getBoundingClientRect(); // world is 1x1px, so width === scale
    const vr = vp.getBoundingClientRect();
    const s = wr.width || 1;
    return {
      x: (cx - wr.left) / s,
      y: (cy - wr.top) / s,
      minX: (vr.left - wr.left) / s,
      minY: (vr.top - wr.top) / s,
      maxX: (vr.right - wr.left) / s,
      maxY: (vr.bottom - wr.top) / s,
    };
  }

  // Only recomputed when x/y change (new hover), NOT on zoom/pan,
  // so the tooltip stays anchored in the world like any other element.
  $: anchor = toWorldSpace(x, y);

  $: maxH = anchor.maxY - anchor.minY - PAD * 2;

  $: pos = (() => {
    const { x: ax, y: ay, minX, minY, maxX, maxY } = anchor;
    const w = tipW || TIP_W;
    const h = Math.min(tipH || 140, maxH);

    const spaceAbove = ay - OFFSET - PAD - minY;
    const spaceBelow = maxY - ay - OFFSET - PAD;

    let left: number;
    let top: number;

    if (h <= spaceAbove) {
      top = ay - OFFSET - h;
      left = Math.max(minX + PAD, Math.min(ax - w / 2, maxX - w - PAD));
    } else if (h <= spaceBelow) {
      top = ay + OFFSET;
      left = Math.max(minX + PAD, Math.min(ax - w / 2, maxX - w - PAD));
    } else {
      const spaceLeft = ax - OFFSET - PAD - minX;
      const spaceRight = maxX - ax - OFFSET - PAD;
      if (w <= spaceLeft || spaceLeft >= spaceRight) {
        left = Math.max(minX + PAD, ax - OFFSET - w);
      } else {
        left = Math.min(maxX - w - PAD, ax + OFFSET);
      }
      top = Math.max(minY + PAD, Math.min(ay - h / 2, maxY - h - PAD));
    }

    return { left, top };
  })();

  function portal(node: HTMLElement) {
    const target = canvas?.getWorld() ?? document.body;
    target.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }
</script>

{#if term || paragraphs.length > 0}
  <div
    class="keyword-tooltip"
    class:pinned
    use:portal
    use:measureTip
    style:left="{pos.left}px"
    style:top="{pos.top}px"
    style:width="{TIP_W}px"
    style:z-index={100050 + depth}
  >
    {#if term}
      <div class="kw-term">{cleanBracketText(term)}</div>
    {/if}
    {#if paragraphs.length > 0}
      <div class="kw-def">
        {#each paragraphs as para}
          <p class="kw-para">
            {#each para.split("\n") as line, li}
              {#if li > 0}<br />{/if}
              <KeywordText
                text={line}
                useColorCoding={true}
                depth={depth + 1}
              />
            {/each}
          </p>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .keyword-tooltip {
    position: fixed;
    box-sizing: border-box;
    max-height: calc(100vh - 16px);
    overflow-y: auto;
    padding: 0.55rem 0.75rem;
    background: rgba(6, 8, 12, 0.98);
    border: 1px solid #3a3326;
    border-top: 2px solid #8a6a2e;
    box-shadow:
      0 12px 28px rgba(0, 0, 0, 0.88),
      0 0 0 1px #000;
    pointer-events: none;
    font-family: "FontinRegular", "Fontin", "Palatino Linotype", Georgia, serif;
    text-align: center;
    color: #b6aa82;
    scrollbar-width: thin;
  }

  .keyword-tooltip.pinned {
    pointer-events: auto;
    border-color: #8a6a2e;
    border-top-color: #d4a753;
  }

  .kw-term {
    font-size: 1.05rem;
    font-weight: 700;
    color: #ede1c0;
    text-align: center;
    margin-bottom: 0.35rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid rgba(138, 106, 46, 0.35);
    line-height: 1.2;
  }

  .kw-def {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.92rem;
    line-height: 1.32;
    color: #b6aa82;
    text-align: center;
  }

  .kw-para {
    margin: 0;
    width: 100%;
    text-align: center;
  }
</style>
