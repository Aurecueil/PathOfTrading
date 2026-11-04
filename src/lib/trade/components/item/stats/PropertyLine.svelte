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
  $: isItalic = prop.type === 77;
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
  <span class="prop-item prop-progress" class:is-italic={isItalic}>
    {#if prop.icon}<CdnImage
        src={prop.icon}
        alt=""
        className="prop-icon"
      />{/if}
    <ProgressBar text={valuesText} {ratio} />
  </span>
{:else if mode === DisplayMode.ValuesInsertedByIndex}
  <span class="prop-item wrap-text" class:is-italic={isItalic}>
    {#if prop.icon}<CdnImage
        src={prop.icon}
        alt=""
        className="prop-icon"
      />{/if}
    <span class="tpl"
      >{#each parts as part}{#if part.kind === "text"}<KeywordText
            text={part.text}
            useColorCoding
          />{:else}<span class="val" style="color: {part.color}"
            ><KeywordText text={part.text} /></span
          >{/if}{/each}</span
    >
    {#if suffix}<span class="suffix">{suffix}</span>{/if}
  </span>
{:else if mode === DisplayMode.ValuesFollowedByName}
  <span class="prop-item" class:is-italic={isItalic}>
    {#if prop.icon}<CdnImage
        src={prop.icon}
        alt=""
        className="prop-icon"
      />{/if}
    {#each values as val, vi}
      <span class="val" style="color: {val.color}"
        ><KeywordText text={val.text} />{vi < values.length - 1
          ? ","
          : ""}</span
      >
    {/each}
    {#if name}
      <span class="label"><KeywordText text={name} useColorCoding /></span>
    {/if}
    {#if suffix}<span class="suffix">{suffix}</span>{/if}
  </span>
{:else}
  <!-- NameFollowedByValues (0) and any unknown mode. Empty name => values only. -->
  <span class="prop-item" class:is-italic={isItalic}>
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
      <span class="val" style="color: {val.color}"
        ><KeywordText text={val.text} />{vi < values.length - 1
          ? ","
          : ""}</span
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
    font-weight: 400;
    line-height: 1.22;
    color: #7f7f7f;
  }
  .prop-item.is-italic {
    font-style: italic;
  }
  .prop-item.wrap-text {
    white-space: normal;
    text-align: center;
  }
  .prop-item.prop-progress {
    display: flex;
    width: 100%;
  }
  .label,
  .label.tag-only,
  .tpl,
  .suffix {
    color: #7f7f7f;
    font-weight: 400;
  }
  .val {
    font-weight: 400;
    color: #f1f5f9;
  }
  .prop-sep {
    display: block;
    flex-basis: 100%;
    width: 100%;
    height: var(--sep-h, 8px);
    margin: 1px 0;
    background: var(--sep-img, none) center no-repeat;
  }
  :global(.prop-icon) {
    width: 15px;
    height: 15px;
    object-fit: contain;
  }
</style>
