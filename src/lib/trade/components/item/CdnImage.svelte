<!-- src/lib/components/common/CdnImage.svelte -->
<script lang="ts">
  import { fetchCdnImage } from "$lib/trade/utilis/imageService";

  const CDN_BASE = "https://web.poecdn.com";

  export let src: string | undefined = undefined;
  export let alt: string = "";
  export let className: string = "";
  export let loading: "lazy" | "eager" = "lazy";

  let resolvedUrl: string = "";
  let isLoading: boolean = false;
  let hasError: boolean = false;

  /**
   * Normalizes an image URL:
   * - unescapes JSON-style slashes (\/ -> /)
   * - prefixes the CDN host when the URL has no host
   * - leaves absolute (http/https), protocol-relative, blob: and data: URLs alone
   */
  function normalizeUrl(raw: string): string {
    const url = raw.trim().replace(/\\\//g, "/");

    // Already absolute or special scheme
    if (/^(https?:)?\/\//i.test(url) || /^(blob|data):/i.test(url)) {
      return url.startsWith("//") ? `https:${url}` : url;
    }

    // Relative path -> prefix CDN
    return `${CDN_BASE}/${url.replace(/^\/+/, "")}`;
  }

  $: normalizedSrc = src ? normalizeUrl(src) : undefined;

  $: if (normalizedSrc) {
    loadImage(normalizedSrc);
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
    decoding="async"
    draggable="false"
    class:loading={isLoading}
    class:error={hasError}
    on:error={() => {
      // If cached blob URL fails or expires, try raw fallback
      if (normalizedSrc && resolvedUrl !== normalizedSrc) {
        resolvedUrl = normalizedSrc;
      }
    }}
  />
{/if}

<style>
  img {
    transition: opacity 0.2s ease-in-out;
  }
  img.loading {
    opacity: 0.4;
  }
  /* cache failed and we fell back to the raw URL: keep it visible */
  img.error {
    opacity: 1;
  }
</style>
