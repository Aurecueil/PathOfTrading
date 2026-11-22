<!-- src/lib/trade/components/item/ItemIcon.svelte -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import type { ResolvedDisplayStyle } from "$lib/types/types";
  import type { Item } from "$lib/types/tradeItem";
  import ItemSockets from "./ItemSockets.svelte";
  import CdnImage from "./CdnImage.svelte";
  import {
    extractInfluenceSprite,
    getElderBgUrl,
    getShaperAlphaMask,
    loadScrollingShaperSheet,
  } from "./shaperSprite";
  import {
    enableShaperEffect,
    maskShaperBgWithCdnAlpha,
  } from "$lib/trade/tradeStore";

  export let item: Item;
  export let styleMode: ResolvedDisplayStyle = "full";
  /** Base size (px) of a 1x1 inventory cell; scales down automatically if container is narrower */
  export let baseCellSize: number = 62;

  let hostWidth = 0;
  let isVisible = true;
  let shaperCanvas: HTMLCanvasElement | null = null;

  $: itemW = Math.max(1, item.w || 1);
  $: itemH = Math.max(1, item.h || 1);

  $: isShaper = Boolean(item.shaper || item.influences?.shaper);
  $: isElder = Boolean(item.elder || item.influences?.elder);
  $: showShaperEffect = $enableShaperEffect && isShaper;
  $: isDualInfluence = showShaperEffect && isElder;

  $: elderBgUrl = isDualInfluence ? getElderBgUrl(itemW, itemH) : "";

  const SHAPER_JUMPS_PER_SEC = 32;
  const SHAPER_JUMP_STEP = 0.1;

  // Independent random starting offsets in [0, 405) (405 === 0)
  let scrollX = Math.floor(Math.random() * 405);
  let scrollY = Math.floor(Math.random() * 405);

  let rafId: number | null = null;
  let animGen = 0;

  function stopShaperScroll() {
    animGen++;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  async function startShaperScroll(
    w: number,
    h: number,
    useAlphaMask: boolean,
  ) {
    stopShaperScroll();
    const gen = animGen;

    try {
      const [sheet, alphaMask] = await Promise.all([
        loadScrollingShaperSheet(),
        useAlphaMask ? getShaperAlphaMask(w, h) : Promise.resolve(null),
      ]);

      if (gen !== animGen) return;

      // In ScrollingShaperBackground.png (595x690):
      // (0, 0) corresponds to x1=50, y1=50, x2=145, y2=240 for a 2x4 item -> 47.5px per cell
      const BASE_X = 50;
      const BASE_Y = 50;
      const CELL_PX = 47.5;
      const cropW = w * CELL_PX;
      const cropH = h * CELL_PX;

      const jumpIntervalMs = 1000 / SHAPER_JUMPS_PER_SEC;
      let lastJumpTime = performance.now();
      let needsDraw = true;

      const renderFrame = (now: number) => {
        if (gen !== animGen) return;

        if (isVisible && shaperCanvas) {
          const elapsed = now - lastJumpTime;
          if (elapsed >= jumpIntervalMs) {
            const ticks = Math.floor(elapsed / jumpIntervalMs);
            lastJumpTime += ticks * jumpIntervalMs;

            // Wrap within [0, 405) since 405 === 0
            scrollX = (scrollX + ticks * SHAPER_JUMP_STEP) % 405;
            scrollY = (scrollY + ticks * SHAPER_JUMP_STEP) % 405;
            needsDraw = true;
          }

          if (needsDraw) {
            needsDraw = false;
            const cw = shaperCanvas.width;
            const ch = shaperCanvas.height;
            if (cw > 0 && ch > 0) {
              const ctx = shaperCanvas.getContext("2d");
              if (ctx) {
                ctx.globalCompositeOperation = "source-over";
                ctx.clearRect(0, 0, cw, ch);
                ctx.drawImage(
                  sheet,
                  BASE_X + scrollX,
                  BASE_Y + scrollY,
                  cropW,
                  cropH,
                  0,
                  0,
                  cw,
                  ch,
                );

                if (useAlphaMask && alphaMask) {
                  ctx.globalCompositeOperation = "destination-in";
                  ctx.drawImage(alphaMask, 0, 0, cw, ch);
                  ctx.globalCompositeOperation = "source-over";
                }
              }
            }
          }
        }

        rafId = requestAnimationFrame(renderFrame);
      };

      rafId = requestAnimationFrame(renderFrame);
    } catch (err) {
      console.error("Failed to start Shaper background scroll:", err);
    }
  }

  $: if (showShaperEffect && isVisible && shaperCanvas) {
    startShaperScroll(itemW, itemH, $maskShaperBgWithCdnAlpha);
  } else {
    stopShaperScroll();
  }

  onDestroy(() => {
    stopShaperScroll();
  });

  function watchVisibility(node: HTMLElement) {
    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { rootMargin: "100px" },
    );
    io.observe(node);
    return {
      destroy: () => io.disconnect(),
    };
  }

  let extractedSrc: string | null = null;
  let naturalIconSize: { w: number; h: number } | null = null;
  let lastExtractKey = "";

  $: if (item.icon && showShaperEffect) {
    const key = `${isElder ? "se" : "s"}|${item.icon}|${itemW}x${itemH}`;
    if (key !== lastExtractKey) {
      lastExtractKey = key;
      extractedSrc = null;
      naturalIconSize = null;
      extractInfluenceSprite(item.icon, itemW, itemH, isElder).then(
        (extracted) => {
          if (lastExtractKey === key && extracted) {
            extractedSrc = extracted.src;
            naturalIconSize = { w: extracted.width, h: extracted.height };
          }
        },
      );
    }
  } else {
    lastExtractKey = "";
    extractedSrc = null;
    naturalIconSize = null;
  }

  // Target cell size adapts to available host width while keeping exact w:h proportions
  $: effectiveCellSize = (() => {
    if (styleMode === "minimal") return 48 / Math.max(itemW, itemH);
    if (hostWidth > 0) {
      const maxFromHost = hostWidth / 2;
      return Math.min(Math.max(maxFromHost, 38), 84);
    }
    return baseCellSize;
  })();

  $: iconDimensions = (() => {
    if (styleMode === "minimal") {
      return { w: 48, h: 48 };
    }
    return {
      w: Math.round(itemW * effectiveCellSize),
      h: Math.round(itemH * effectiveCellSize),
    };
  })();

  // Exact rendered (x, y) box matching the item icon image inside the 92% area
  $: renderedIconBox = (() => {
    const maxW = iconDimensions.w * 0.92;
    const maxH = iconDimensions.h * 0.92;
    const natW = naturalIconSize?.w || itemW;
    const natH = naturalIconSize?.h || itemH;
    const scale = Math.min(maxW / natW, maxH / natH);
    return {
      w: Math.max(1, Math.round(natW * scale)),
      h: Math.max(1, Math.round(natH * scale)),
    };
  })();

  // When maskShaperBgWithCdnAlpha is false, fill the entire icon box;
  // when true, match the exact icon box where the CDN Shaper alpha mask applies.
  $: shaperLayerSize = $maskShaperBgWithCdnAlpha
    ? renderedIconBox
    : { w: iconDimensions.w, h: iconDimensions.h };

  // Actual rendered cell size inside the 92% padded image area
  $: renderedCellSize = (iconDimensions.w * 0.92) / itemW;

  $: stackMaxed =
    item.stackSize !== undefined &&
    item.maxStackSize !== undefined &&
    item.stackSize >= item.maxStackSize;

  $: nonGemSockets = (item.sockets || []).filter(
    (s) => (s.type || "").toLowerCase() !== "gem",
  );
  $: hasEquipmentSockets = nonGemSockets.length > 0;
</script>

<div class="item-icon-host" bind:clientWidth={hostWidth} use:watchVisibility>
  <div
    class="item-icon-wrapper mode-{styleMode}"
    class:is-shaper={showShaperEffect}
    class:is-elder={isDualInfluence}
    class:is-corrupted={styleMode !== "minimal" &&
      (item.corrupted || item.doubleCorrupted)}
    class:is-sanctified={styleMode !== "minimal" && item.sanctified}
    class:is-fractured={styleMode !== "minimal" && item.fractured}
    class:is-unidentified={styleMode !== "minimal" && item.identified === false}
    style:width="{iconDimensions.w}px"
    style:height="{iconDimensions.h}px"
    style:aspect-ratio={styleMode === "minimal"
      ? "1 / 1"
      : `${itemW} / ${itemH}`}
  >
    <!-- Bottom layer (z-index: 0): Scrolling Shaper background -->
    {#if showShaperEffect}
      <canvas
        bind:this={shaperCanvas}
        width={shaperLayerSize.w}
        height={shaperLayerSize.h}
        aria-hidden="true"
        class="shaper-bg-layer"
        class:fill-box={!$maskShaperBgWithCdnAlpha}
        style:width="{shaperLayerSize.w}px"
        style:height="{shaperLayerSize.h}px"
      ></canvas>
    {/if}

    <!-- Middle layer (z-index: 1): Static Elder background when both Shaper + Elder -->
    {#if isDualInfluence && elderBgUrl}
      <div
        class="elder-bg-layer"
        style:width="{renderedIconBox.w}px"
        style:height="{renderedIconBox.h}px"
        aria-hidden="true"
      >
        <CdnImage
          src={elderBgUrl}
          alt=""
          className="elder-bg-img"
          loading="lazy"
        />
      </div>
    {/if}

    <!-- Top layer (z-index: 2): Static extracted item icon with outline (or raw icon if disabled) -->
    {#if showShaperEffect && extractedSrc}
      <img
        src={extractedSrc}
        alt={item.typeLine || item.name}
        class="item-icon shaper-extracted"
        style:width="{renderedIconBox.w}px"
        style:height="{renderedIconBox.h}px"
      />
    {:else if item.icon}
      <CdnImage
        src={item.icon}
        alt={item.typeLine || item.name}
        className="item-icon"
        loading="lazy"
      />
    {/if}

    <!-- Minimal mode: image only, never any socket graphics -->
    {#if styleMode !== "minimal" && hasEquipmentSockets}
      <ItemSockets
        sockets={item.sockets ?? []}
        socketedItems={item.socketedItems ?? []}
        w={itemW}
        h={itemH}
        realm={item.realm === "poe2" ? "poe2" : "poe"}
        cellSize={renderedCellSize}
      />
    {/if}

    {#if item.stackSize}
      <span class="stack-badge" class:maxed={stackMaxed}>
        {item.stackSize}{styleMode === "full" && item.maxStackSize
          ? `/${item.maxStackSize}`
          : ""}
      </span>
    {/if}
    {#if item.iconTierText}
      <span class="tier-text">{item.iconTierText}</span>
    {/if}
  </div>
</div>

<style>
  .item-icon-host {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  .item-icon-wrapper {
    --_rgb: var(--rc-rgb, 127, 127, 127);
    position: relative;
    background: radial-gradient(
        circle at 50% 42%,
        rgba(var(--_rgb), 0.2) 0%,
        rgba(var(--_rgb), 0.05) 48%,
        transparent 78%
      ),
      linear-gradient(180deg, #11141b 0%, #05070a 100%);
    border: 1px solid rgba(var(--_rgb), 0.38);
    border-radius: 0;
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.8),
      inset 0 0 14px rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .item-icon-wrapper::after {
    content: "";
    position: absolute;
    inset: 3px;
    border: 1px solid rgba(var(--_rgb), 0.12);
    pointer-events: none;
    z-index: 0;
  }

  .shaper-bg-layer {
    position: absolute;
    z-index: 0;
    max-width: 92%;
    max-height: 92%;
    pointer-events: none;
    user-select: none;
  }

  .shaper-bg-layer.fill-box {
    inset: 0;
    max-width: 100%;
    max-height: 100%;
  }

  .elder-bg-layer {
    position: absolute;
    z-index: 1;
    max-width: 92%;
    max-height: 92%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    user-select: none;
  }

  :global(.elder-bg-layer .elder-bg-img) {
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    -webkit-user-drag: none;
  }

  .item-icon-wrapper.is-unidentified {
    background: radial-gradient(
        circle at 50% 42%,
        rgba(210, 0, 0, 0.22) 0%,
        transparent 75%
      ),
      linear-gradient(180deg, #1a0c0c 0%, #060304 100%);
  }
  .item-icon-wrapper.is-corrupted {
    border-color: rgba(210, 0, 0, 0.6);
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.8),
      inset 0 0 16px rgba(210, 0, 0, 0.25);
  }
  .item-icon-wrapper.is-sanctified {
    border-color: rgba(162, 145, 98, 0.8);
  }
  .item-icon-wrapper.is-fractured {
    border-color: rgba(162, 145, 98, 0.7);
  }

  :global(.item-icon-wrapper .item-icon) {
    position: relative;
    width: 92%;
    height: 92%;
    max-width: 92%;
    max-height: 92%;
    object-fit: contain;
    z-index: 2;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.7));
    user-select: none;
    -webkit-user-drag: none;
  }

  /* Slight black outline around the extracted Shaper / Shaper+Elder sprite */
  .item-icon.shaper-extracted {
    filter: drop-shadow(1px 0 0 rgba(0, 0, 0, 0.95))
      drop-shadow(-1px 0 0 rgba(0, 0, 0, 0.95))
      drop-shadow(0 1px 0 rgba(0, 0, 0, 0.95))
      drop-shadow(0 -1px 0 rgba(0, 0, 0, 0.95))
      drop-shadow(0 3px 6px rgba(0, 0, 0, 0.8));
  }

  .stack-badge {
    position: absolute;
    top: 2px;
    left: 5px;
    z-index: 3;
    font-family: "FontinRegular", Georgia, serif;
    font-size: 0.95rem;
    font-weight: 400;
    line-height: 1.1;
    color: #fff;
    text-shadow:
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000,
      0 0 4px #000;
    pointer-events: none;
  }
  .stack-badge.maxed {
    color: #00bafe;
  }
  .mode-minimal .stack-badge {
    font-size: 0.78rem;
    left: 3px;
  }
  .tier-text {
    position: absolute;
    bottom: 2px;
    left: 5px;
    z-index: 3;
    font-family: "FontinRegular", Georgia, serif;
    font-size: 0.85rem;
    font-weight: 400;
    line-height: 1.1;
    color: #fff;
    text-shadow:
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000,
      0 0 4px #000;
    pointer-events: none;
  }
  .mode-minimal .tier-text {
    font-size: 0.7rem;
    left: 3px;
  }
</style>
