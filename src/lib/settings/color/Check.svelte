<!-- src\lib\settings\color\Check.svelte -->
<script lang="ts">
  let {
    checked,
    disabled = false,
    title = "",
    label = "",
    onchange,
  }: {
    checked: boolean;
    disabled?: boolean;
    title?: string;
    label?: string;
    onchange: () => void;
  } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<label
  class="pb-check"
  class:is-disabled={disabled}
  {title}
  onclick={(e) => e.stopPropagation()}
>
  <input type="checkbox" {checked} {disabled} onchange={() => onchange()} />
  <span class="pb-box"></span>
  {#if label}<span class="pb-check-text">{label}</span>{/if}
</label>
