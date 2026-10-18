// src/lib/trade/components/item/stats/extractSkills.ts
import type { Item } from "$lib/types/tradeItem";
import { cleanBracketText } from "./statsUtils";

export interface ExtractedSkill {
  icon?: string;
  label: string;
  tooltipItem: Item | null;
}

/** Granted skills & socketed skill gems (always extracted) */
export function extractSkills(item: Item): ExtractedSkill[] {
  const results: ExtractedSkill[] = [];
  const granted = item.grantedSkills || [];
  const skillItems = (item.socketedItems || []).filter(
    (si) =>
      (si.socket === undefined || si.socket === null) &&
      (si.gemSkill ||
        si.frameType === 4 ||
        (si.frameTypeId || "").toLowerCase() === "gem"),
  );

  const usedSkillItems = new Set<Item>();

  const norm = (t?: string) =>
    cleanBracketText(t || "")
      .trim()
      .toLowerCase();
  const itemName = (si: Item) => norm(si.typeLine || si.baseType || si.name);

  for (let i = 0; i < granted.length; i++) {
    const gs = granted[i];
    const valText = (gs.values || [])
      .map((v) => cleanBracketText(v[0]))
      .filter(Boolean)
      .join(", ");
    const baseName = cleanBracketText(gs.name);
    const label = valText
      ? baseName
        ? `${baseName}: ${valText}`
        : valText
      : baseName;

    const wanted = (gs.values || []).map((v) => norm(v[0])).filter(Boolean);

    const free = skillItems.filter((si) => !usedSkillItems.has(si));
    const matched: Item | null =
      free.find((si) => wanted.includes(itemName(si))) ??
      free.find((si) => gs.icon && si.gemSkill && si.gemSkill === gs.icon) ??
      free.find(
        (si) =>
          itemName(si) &&
          wanted.some(
            (w) => w.includes(itemName(si)) || itemName(si).includes(w),
          ),
      ) ??
      (granted.length === skillItems.length ? (free[0] ?? null) : null);

    if (matched) usedSkillItems.add(matched);

    results.push({
      icon: matched?.gemSkill || gs.icon || matched?.icon,
      label,
      tooltipItem: matched,
    });
  }

  for (const si of skillItems) {
    if (usedSkillItems.has(si)) continue;
    const skillName = cleanBracketText(si.typeLine || si.baseType || si.name);
    results.push({
      icon: si.gemSkill || si.icon,
      label: skillName ? `Grants Skill: ${skillName}` : "Grants Skill",
      tooltipItem: si,
    });
  }

  return results;
}
