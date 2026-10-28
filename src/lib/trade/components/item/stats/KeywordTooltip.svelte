<!-- src/lib/trade/components/item/stats/KeywordTooltip.svelte -->
<script lang="ts">
  import KeywordText from "./KeywordText.svelte";
  import { cleanBracketText } from "./statsUtils";

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

  $: pos = (() => {
    if (typeof window === "undefined") {
      return { left: x, top: y };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = tipW || TIP_W;
    const h = tipH || 140;

    const spaceAbove = y - OFFSET - PAD;
    const spaceBelow = vh - y - OFFSET - PAD;

    let left: number;
    let top: number;

    if (h <= spaceAbove) {
      // 1. Default: Above mouse, horizontally centered on mouse X
      top = y - OFFSET - h;
      left = Math.max(PAD, Math.min(x - w / 2, vw - w - PAD));
    } else if (h <= spaceBelow) {
      // 2. Fallback: Below mouse, horizontally centered on mouse X
      top = y + OFFSET;
      left = Math.max(PAD, Math.min(x - w / 2, vw - w - PAD));
    } else {
      // 3. Really tall tooltip: Left of mouse (or right if not enough space on left),
      //    vertically centered on mouse Y
      const spaceLeft = x - OFFSET - PAD;
      const spaceRight = vw - x - OFFSET - PAD;

      if (w <= spaceLeft || spaceLeft >= spaceRight) {
        left = Math.max(PAD, x - OFFSET - w);
      } else {
        left = Math.min(vw - w - PAD, x + OFFSET);
      }

      top = Math.max(PAD, Math.min(y - h / 2, vh - h - PAD));
    }

    return { left, top };
  })();

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
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
