// src/lib/types/mercenary.ts

export type MercenaryStatType =
  | "float"
  | "constant"
  | "additional"
  | "implicit"
  | "flag";

export interface MercenarySkillStat {
  id?: string;
  value?: number;
  type?: MercenaryStatType;
}

export interface MercenarySupportStat {
  id: string;
  value: number;
}

export interface MercenaryQualityStat {
  stat: string;
  stats: Record<string, number>;
}

export interface MercenaryReservations {
  mana_flat?: number;
  mana_percent?: number;
  life_flat?: number;
  life_percent?: number;
}

export interface MercenaryVaal {
  souls: number;
  stored_uses: number;
}

export interface MercenaryActiveSkill {
  id: string;
  display_name: string;
  description: string;
  types?: string[];
  weapon_restrictions: string[];
  is_skill_totem: boolean;
  is_manually_casted: boolean;
  stat_conversions: Record<string, string>;
  skill_totem_life_multiplier?: number;
  minion_types?: string[];
}

export interface MercenarySkillLevel {
  experience?: number;
  required_level?: number;
  cooldown?: number;
  cooldown_bypass_type?: string;
  stored_uses?: number;
  cost_multiplier?: number;
  costs?: Record<string, number>;
  damage_effectiveness?: number;
  damage_multiplier?: number;
  crit_chance?: number;
  attack_speed_multiplier?: number;
  vaal?: MercenaryVaal;
  reservations?: MercenaryReservations;
  stats?: (MercenarySkillStat | null)[];
  stat_text?: Record<string, string>;
  quality_stats?: MercenaryQualityStat[];
}

export interface dataMercenarySkill {
  name: string;
  hash: number;
  description: string;
  required_level: number;
  support_count?: string;
  possible_supports: string[];
  family?: string;
  encounter_granted_effect?: string;
  house_icon: string;
  icon?: string;
  cast_time?: number;
  active_skill?: MercenaryActiveSkill;
  stat_translation_file?: string;
  per_level?: Record<string, MercenarySkillLevel>;
  static?: MercenarySkillLevel;
  tooltip_order?: string[];
}

export type MercenarySkillsMap = Record<string, dataMercenarySkill>;

export interface dataMercenarySupport {
  name: string;
  hash: number;
  tier: number;
  family?: string;
  icon: string;
  stat_translation_file: string;
  stats: MercenarySupportStat[];
  stat_text: Record<string, string>;
}

export type MercenarySupportsMap = Record<string, dataMercenarySupport>;
