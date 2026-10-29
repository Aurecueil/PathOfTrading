// src/lib/i18n.ts // if you need a non-reactive fallback, but inside components use $currentLanguage
import { currentLanguage } from "$lib/trade/tradeStore"; // adjust import path
import { translations } from "./translations";
import { derived } from "svelte/store";

// Option A: A derived store approach (Reactive and clean)
export const t = derived(currentLanguage, ($lang) => {
  return (key: string) => {
    // Fallback to English if the translation is missing
    return translations[key]?.[$lang] || translations[key]?.["EN"] || key;
  };
});
