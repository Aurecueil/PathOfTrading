<!-- src/lib/trade/components/item/stats/SpecialProp.svelte -->
<script lang="ts">
  import CdnImage from "../CdnImage.svelte";
  import StatColorText from "$lib/trade/components/drawer/StatColorText.svelte";
  import { CDN_BASE } from "./statsUtils";
  import type { FormattedPropValue, SpecialKind } from "./propertyGroups";

  export let kind: SpecialKind = "memory";
  export let label: string = "";
  export let values: FormattedPropValue[] = [];

  const MEMORY_TITLE = `${CDN_BASE}/protected/image/item/popup/memory-title.png?v=1747803262058&key=aRX2e62z7JqOmhJAqx2X_A`;
  const MEMORY_ICON = `${CDN_BASE}/protected/image/item/popup/memory-icon.png?v=1747803262058&key=arrpAm9BhRVgnxJXEjRh4w`;
  const INTANGIBILITY_TITLE = `${CDN_BASE}/protected/image/item/popup/intangibility-title.png?v=1783487784104&key=0e1saVG59Xab1DG11bkEqw`;
  const INTANGIBILITY_ICON = `${CDN_BASE}/protected/image/item/popup/intangibility-icon.png?v=1783487784104&key=NAq3DpnrGeivTtsJRPTMww`;

  // skipTop / skipBottom: px cropped from the 40px title graphic.
  // iconDx: negative = closer to the text. iconDy: negative = moved up.
  const SPECIAL_PROPS = {
    memory: {
      title: MEMORY_TITLE,
      icon: MEMORY_ICON,
      nameColor: "#bfe2fa",
      valueColor: "#ffffff",
      skipTop: 10,
      skipBottom: 5,
      iconSize: 28,
      iconDx: -4,
      iconDy: 0,
    },
    intangibility: {
      title: INTANGIBILITY_TITLE,
      icon: INTANGIBILITY_ICON,
      nameColor: "#9bf5bd",
      valueColor: "#ffffff",
      skipTop: 9,
      skipBottom: 4,
      iconSize: 20,
      iconDx: -4,
      iconDy: -3,
    },
  } as const;

  $: cfg = SPECIAL_PROPS[kind];
</script>

<span
  class="special-prop"
  style:background-image="url('{cfg.title}')"
  style:background-position="center -{cfg.skipTop}px"
  style:height="{40 - cfg.skipTop - cfg.skipBottom}px"
>
  <span style="color: {cfg.nameColor}">
    <StatColorText text={label} />{values.length ? ":" : ""}
  </span>
  {#each values as val}
    <span style="color: {cfg.valueColor}">
      <StatColorText text={val.text} />
    </span>
  {/each}
  <span
    class="special-prop-icon-wrap"
    style:width="{cfg.iconSize}px"
    style:height="{cfg.iconSize}px"
    style:margin-left="{cfg.iconDx}px"
    style:transform="translateY({cfg.iconDy}px)"
  >
    <CdnImage src={cfg.icon} alt="" className="special-prop-icon" />
  </span>
</span>

<style>
  .special-prop {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: 100%;
    max-width: 300px;
    box-sizing: border-box;
    background-repeat: no-repeat;
    background-size: 100% 40px;
    font-size: 1rem;
    line-height: 1.2;
    white-space: nowrap;
  }
  .special-prop-icon-wrap {
    display: inline-flex;
    flex-shrink: 0;
  }
  :global(.special-prop-icon) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
