<!-- src/lib/trade/components/item/RelativeTime.svelte -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { clock, register, update } from "$lib/trade/utilis/relativeClock";

  export let time: string | number | Date;
  export let freshThresholdSec: number = 300;

  const entry = { nextChangeAt: Infinity };
  const unregister = register(entry);
  onDestroy(unregister);

  $: targetTime = time ? new Date(time).getTime() : NaN;
  $: now = $clock;

  $: ageSec = isNaN(targetTime)
    ? 0
    : Math.max(0, Math.floor((now - targetTime) / 1000));

  $: isFresh = ageSec < freshThresholdSec;

  $: relativeAge =
    ageSec < 60
      ? `${ageSec}s ago`
      : ageSec < 3600
        ? `${Math.floor(ageSec / 60)}m ago`
        : ageSec < 86400
          ? `${Math.floor(ageSec / 3600)}h ago`
          : `${Math.floor(ageSec / 86400)}d ago`;

  // Seconds until the displayed text (or fresh state) next changes
  function secondsUntilChange(age: number): number {
    let next: number;
    if (age < 60) next = age + 1;
    else if (age < 3600) next = (Math.floor(age / 60) + 1) * 60;
    else if (age < 86400) next = (Math.floor(age / 3600) + 1) * 3600;
    else next = (Math.floor(age / 86400) + 1) * 86400;

    // Also wake up when the "fresh" flag flips
    if (age < freshThresholdSec) next = Math.min(next, freshThresholdSec);
    return next - age;
  }

  $: if (!isNaN(targetTime)) {
    entry.nextChangeAt = now + secondsUntilChange(ageSec) * 1000;
    update(entry);
  } else {
    entry.nextChangeAt = Infinity;
  }

  $: fullDateStr = isNaN(targetTime)
    ? ""
    : new Date(targetTime).toLocaleString();
</script>

<div class="age-badge" class:fresh={isFresh}>
  Listed {relativeAge}
</div>

<style>
  .age-badge {
    font-size: 0.76rem;
    color: #8f8a7b;
  }
  .age-badge.fresh {
    color: #7fd18f;
  }
</style>
