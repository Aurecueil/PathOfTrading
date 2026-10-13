<!-- src/lib/components/common/CdnImage.svelte -->
<script lang="ts">
  import { fetchCdnImage } from "$lib/trade/utilis/imageService";

  export let src: string | undefined = undefined;
  export let alt: string = "";
  export let className: string = "";
  export let loading: "lazy" | "eager" = "lazy";

  let resolvedUrl: string = "";
  let isLoading: boolean = false;
  let hasError: boolean = false;

  $: if (src) {
    loadImage(src);
  } else {
    resolvedUrl = "";
    isLoading = false;
    hasError = false;
  }

  async function loadImage(url: string) {
    isLoading = true;
    hasError = false;

    try {
      const cached = await fetchCdnImage(url);
      resolvedUrl = cached;
    } catch (err) {
      console.error(`[CdnImage] Failed caching image for ${url}:`, err);
      // Fallback to direct URL if caching fails
      resolvedUrl = url;
      hasError = true;
    } finally {
      isLoading = false;
    }
  }
</script>

{#if resolvedUrl}
  <img
    src={resolvedUrl}
    {alt}
    class={className}
    {loading}
    class:loading={isLoading}
    class:error={hasError}
    on:error={() => {
      // If cached blob URL fails or expires, try raw fallback
      if (resolvedUrl !== src && src) {
        resolvedUrl = src;
      }
    }}
  />
{/if}

<style>
  img {
    transition: opacity 0.15s ease-in-out;
  }
  img.loading {
    opacity: 0.6;
  }
</style>
