<script lang="ts">
  /** Shows a game icon only for stats that exist in exactly one game. */
  export let realms: string[] | undefined = undefined;
  $: realm = realms && realms.length === 1 ? realms[0] : null;
</script>

{#if realm}
  <img
    class="realm-icon"
    src={realm === "poe2" ? "/poe2.png" : "/poe.png"}
    alt={realm}
    title={realm === "poe2" ? "PoE 2 only" : "PoE 1 only"}
  />
{/if}

<style>
  .realm-icon {
    width: 14px;
    height: 14px;
    object-fit: contain;
    flex-shrink: 0;
  }
</style>
