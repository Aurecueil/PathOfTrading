<!-- src/lib/trade/components/item/stats/ProgressBar.svelte -->
<script lang="ts">
  import CdnImage from "../CdnImage.svelte";
  import KeywordText from "./KeywordText.svelte";

  const FRAME =
    "/protected/image/item/popup/progress-bar.png?v=1709582916256&key=uaOIWkQVsD3Y4EcgWdI9Kg";
  const FILL =
    "/protected/image/item/popup/progress-bar-fill.png?v=1709582916256&key=fAsSR0XAYsaYycMLyFa7oQ";

  /** Optional line above the bar (e.g. "Incubating <name>") */
  export let label: string = "";
  /** Text rendered inside the bar */
  export let text: string = "";
  export let ratio: number = 0;

  $: pct =
    Math.round(
      Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0)) * 1000,
    ) / 10;
</script>

<div
  class="progress"
  role="progressbar"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={pct}
>
  {#if label}
    <div class="p-label"><KeywordText text={label} useColorCoding /></div>
  {/if}
  <div class="bar">
    <CdnImage src={FRAME} alt="" className="pb-frame" />
    <div class="track">
      <div class="fill" style="width: {pct}%">
        <CdnImage src={FILL} alt="" className="pb-fill" />
      </div>
    </div>
    {#if text}
      <span class="p-text"><KeywordText {text} /></span>
    {/if}
  </div>
</div>

<style>
  .progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 100%;
    min-width: 0;
  }
  .p-label {
    font-size: 0.95rem;
    line-height: 1.2;
    color: #cbd5e1;
    text-align: center;
  }
  /* 2x the original 212px frame */
  .bar {
    position: relative;
    display: flex;
    align-items: center;
    width: min(100%, 424px);
    box-sizing: border-box;
    padding: 3px 4px;
  }
  .bar :global(.pb-frame) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    pointer-events: none;
  }
  .track {
    position: relative;
    width: 100%;
  }
  .fill {
    height: 1em;
    font-size: 0.95rem;
    overflow: hidden;
  }
  /* the fill art is a slice, so stretching it equals repeat-x */
  .fill :global(.pb-fill) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
  }
  .p-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    font-size: 0.86rem;
    font-weight: 600;
    color: #fff;
    text-shadow:
      0 0 3px #000,
      0 1px 1px #000;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
  }
</style>
