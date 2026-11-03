<!-- src/lib/trade/components/item/stats/PropertyLine.svelte -->
<script lang="ts">
  import { DisplayMode, type ItemProperty } from "$lib/types/tradeItem";
  import CdnImage from "../CdnImage.svelte";
  import KeywordText from "./KeywordText.svelte";
  import ProgressBar from "./ProgressBar.svelte";
  import { resolvePropertyColor } from "./propertyColors";

  export let prop: ItemProperty;
  export let isPoe2: boolean = false;
  /** requirement style: "Level 60" instead of "Level: 60" */
  export let noColon: boolean = false;

  type Val = { text: string; color: string };
  type Part =
    | { kind: "text"; text: string }
    | { kind: "value"; text: string; color: string };

  $: mode = (prop.displayMode ??
    DisplayMode.NameFollowedByValues) as DisplayMode;
  $: name = (prop.name ?? "").trim();
  $: values = (prop.values ?? []).map(
    ([text, idx]): Val => ({
      text: text ?? "",
      color: resolvePropertyColor(idx, isPoe2),
    }),
  );
  $: suffix = (prop.suffix ?? "").trim();
  $: parts =
    mode === DisplayMode.ValuesInsertedByIndex
      ? buildTemplate(name, values)
      : [];
  $: valuesText = values.map((v) => v.text).join(", ");
  $: ratio = resolveRatio(prop, values);

  function buildTemplate(tpl: string, vals: Val[]): Part[] {
    return tpl
      .split(/(\{\d+\})/)
      .filter((s) => s !== "")
      .map((seg): Part => {
        const m = seg.match(/^\{(\d+)\}$/);
        if (!m) return { kind: "text", text: seg };
        const v = vals[Number(m[1])];
        return v ? { kind: "value", ...v } : { kind: "text", text: "" };
      });
  }

  function resolveRatio(p: ItemProperty, vals: Val[]): number {
    if (typeof p.progress === "number") return p.progress;
    const m = (vals[0]?.text ?? "").match(
      /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/,
    );
    return m && Number(m[2]) > 0 ? Number(m[1]) / Number(m[2]) : 0;
  }
</script>

{#if mode === DisplayMode.Separator}
  <span class="prop-sep" role="separator"></span>
{:else if mode === DisplayMode.ProgressBar}
  <span class="prop-item prop-progress">
    {#if prop.icon}<CdnImage
        src={prop.icon}
        alt=""
        className="prop-icon"
      />{/if}
    <ProgressBar text={valuesText} {ratio} />
  </span>
{:else if mode === DisplayMode.ValuesInsertedByIndex}
  <span class="prop-item wrap-text">
    {#if prop.icon}<CdnImage
        src={prop.icon}
        alt=""
        className="prop-icon"
      />{/if}
    <span class="tpl"
      >{#each parts as part}{#if part.kind === "text"}<KeywordText
            text={part.text}
            useColorCoding
          />{:else}<strong style="color: {part.color}"
            ><KeywordText text={part.text} /></strong
          >{/if}{/each}</span
    >
    {#if suffix}<span class="suffix">{suffix}</span>{/if}
  </span>
{:else if mode === DisplayMode.ValuesFollowedByName}
  <span class="prop-item">
    {#if prop.icon}<CdnImage
        src={prop.icon}
        alt=""
        className="prop-icon"
      />{/if}
    {#each values as val, vi}
      <strong style="color: {val.color}"
        ><KeywordText text={val.text} />{vi < values.length - 1
          ? ","
          : ""}</strong
      >
    {/each}
    {#if name}
      <span class="label"><KeywordText text={name} useColorCoding /></span>
    {/if}
    {#if suffix}<span class="suffix">{suffix}</span>{/if}
  </span>
{:else}
  <!-- NameFollowedByValues (0) and any unknown mode. Empty name => values only. -->
  <span class="prop-item">
    {#if prop.icon}<CdnImage
        src={prop.icon}
        alt=""
        className="prop-icon"
      />{/if}
    {#if name}
      <span class="label" class:tag-only={values.length === 0}
        ><KeywordText text={name} useColorCoding />{values.length > 0 &&
        !noColon
          ? ":"
          : ""}</span
      >
    {/if}
    {#each values as val, vi}
      <strong style="color: {val.color}"
        ><KeywordText text={val.text} />{vi < values.length - 1
          ? ","
          : ""}</strong
      >
    {/each}
    {#if suffix}<span class="suffix">{suffix}</span>{/if}
  </span>
{/if}

<style>
  .prop-item {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    white-space: normal;
    max-width: 100%;
    min-width: 0;
    overflow-wrap: anywhere;
    text-align: center;
    gap: 0.1rem 0.32rem;
    font-size: 0.95rem;
    line-height: 1.22;
    color: #cbd5e1;
  }
  .prop-item.wrap-text {
    white-space: normal;
    text-align: center;
  }
  .prop-item.prop-progress {
    display: flex;
    width: 100%;
  }
  .label {
    color: #8b9bb4;
  }
  .label.tag-only {
    color: #94a3b8;
  }
  strong {
    font-weight: 600;
    color: #f1f5f9;
  }
  .suffix {
    color: #8b95a5;
  }
  .prop-sep {
    display: block;
    flex-basis: 100%;
    width: 60%;
    height: 1px;
    margin: 0.1rem auto;
    background: linear-gradient(
      90deg,
      transparent,
      #283042 20%,
      #283042 80%,
      transparent
    );
  }
  :global(.prop-icon) {
    width: 15px;
    height: 15px;
    object-fit: contain;
  }
</style>
