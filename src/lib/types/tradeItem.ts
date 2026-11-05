// src/lib/types/tradeItem.ts

/**
 * Common enums & unions
 */
import type { Realm } from "$lib/types/leagues";

export enum FrameType {
  Normal = 0,
  Magic = 1,
  Rare = 2,
  Unique = 3,
  Gem = 4,
  Currency = 5,
  DivinationCard = 6,
  Quest = 7,
  Prophecy = 8,
  Foil = 9,
  SupporterFoil = 10,
  Necropolis = 11,
  Gold = 12,
  BreachSkill = 13,
}

export enum DisplayMode {
  NameFollowedByValues = 0,
  ValuesFollowedByName = 1,
  ProgressBar = 2,
  ValuesInsertedByIndex = 3,
  Separator = 4,
}

export type ItemRarity = "Normal" | "Magic" | "Rare" | "Unique";

export type PoE1SocketAttr = "S" | "D" | "I" | "G" | "A" | "DV";
export type PoE1SocketColour = "R" | "G" | "B" | "W" | "A" | "DV";
export type ItemColour = "S" | "D" | "I" | "G";

export type PoE2SocketType = "gem" | "jewel" | "rune";
export type PoE2SocketItem =
  | "emerald"
  | "sapphire"
  | "ruby"
  | "rune"
  | "soulcore"
  | "primaltalisman"
  | "vividtalisman"
  | "wildtalisman"
  | "sacredtalisman"
  | "activegem"
  | "supportgem";

export type ExpeditionFactionId =
  | "Faction1"
  | "Faction2"
  | "Faction3"
  | "Faction4";

/**
 * Sockets & Mods
 */
export interface ItemSocket {
  group: number;
  /** PoE1 attribute requirement */
  attr?: PoE1SocketAttr;
  /** PoE1 socket display colour */
  sColour?: PoE1SocketColour;
  /** PoE2 socket type */
  type?: PoE2SocketType | string;
  /** PoE2 inserted item type */
  item?: PoE2SocketItem | string;
}

export interface ItemModMagnitude {
  min: string;
  max: string;
  hash?: string;
}

export interface ItemModInfo {
  name?: string;
  tier?: string;
  level?: number;
  magnitudes?: ItemModMagnitude[] | null;
}

export interface ItemModFlags {
  fractured?: boolean;
  mutated?: boolean;
  crafted?: boolean;
  /** PoE2 only */
  desecrated?: boolean;
  /** PoE1 only */
  vestigial?: boolean;
}

export interface ItemMod {
  description: string;
  flags?: ItemModFlags;
  domain?: string;
  hash?: string;
  mods?: ItemModInfo[];
}

/**
 * Properties & Requirements
 * Values format: [displayValue: string, valueType: number]
 */
export type ItemPropertyValue = [string, number];

export interface ItemProperty {
  name: string;
  values: ItemPropertyValue[];
  displayMode?: DisplayMode;
  progress?: number;
  type?: number;
  suffix?: string;
  icon?: string;
  domain?: string;
  hash?: string;
}

export interface MercenarySkillSupport {
  hash: number;
  name: string;
  tier: number;
}

export interface MercenarySkill {
  hash: number;
  icon: string;
  name: string;
  supports?: MercenarySkillSupport[];
}

export interface CrucibleNode {
  skill?: string;
  tier?: number;
  icon?: string;
  allocated?: boolean;
  inners?: number[];
  orbit?: number;
  orbitIndex?: number;
  stats?: string[];
  [key: string]: unknown;
}

export interface CrucibleTree {
  layout: string;
  nodes: Record<string, CrucibleNode>;
}

export interface LogbookFaction {
  id: ExpeditionFactionId | string;
  name: string;
}

export interface LogbookMod {
  name: string;
  faction: LogbookFaction;
  mods: Array<string | ItemMod>;
}

export interface UltimatumMod {
  type: string;
  tier: number;
}

export interface ItemRewardGroup {
  label: string;
  /** Map of reward key to count */
  rewards: Record<string, number>;
}

export interface IncubatedItemProgress {
  name: string;
  level: number;
  progress: number;
  total: number;
}

export interface EnshroudedProgress {
  unique?: string;
  progress: number;
  total: number;
}

export interface ScourgedProgress {
  tier: number;
  level?: number;
  progress?: number;
  total?: number;
}

export interface HybridGem {
  isVaalGem?: boolean;
  baseTypeName: string;
  properties?: ItemProperty[];
  explicitMods?: string[];
  secDescrText?: string;
}

export interface ItemInfluences {
  shaper?: boolean;
  elder?: boolean;
  hunter?: boolean;
  crusader?: boolean;
  redeemer?: boolean;
  warlord?: boolean;
  [key: string]: boolean | undefined;
}

export interface ExtendedModHashes {
  explicit?: string[][];
  implicit?: string[][];
  rune?: string[][];
  enchant?: string[][];
  fractured?: string[][];
  crafted?: string[][];
  scourge?: string[][];
  pseudo?: string[][];
  [key: string]: string[][] | undefined;
}

export interface ExtendedItemData {
  prefixes?: number;
  suffixes?: number;
  base_defence_percentile?: number;
  ar?: number;
  ar_aug?: boolean;
  ev?: number;
  ev_aug?: boolean;
  es?: number;
  es_aug?: boolean;
  dps?: number;
  dps_aug?: boolean;
  pdps?: number;
  pdps_aug?: boolean;
  edps?: number;
  edps_aug?: boolean;
  ward?: number;
  ward_aug?: boolean;
  text?: string;
  hashes?: ExtendedModHashes;
  [key: string]: unknown;
}
export interface GemTabPage {
  skillName?: string;
  properties?: ItemProperty[];
  stats?: string[];
  description?: string;
}
export interface GemTab {
  name: string;
  pages: GemTabPage[];
}
/**
 * Main Item Interface
 */
export interface Item {
  // Identity & Placement
  id?: string;
  name: string;
  typeLine: string;
  baseType: string;
  rarity?: ItemRarity;
  ilvl: number;
  identified: boolean;
  verified: boolean;
  w: number;
  h: number;
  icon: string;
  league?: string;
  realm?: Realm;

  // Stash & Socket positions
  x?: number;
  y?: number;
  inventoryId?: string;
  socket?: number;
  colour?: ItemColour;
  socketedIcon?: string;

  // Frames & Visuals
  /** @deprecated Use frameTypeId */
  frameType?: FrameType;
  frameTypeId: string;
  artFilename?: string;

  // Stacks & Levels
  stackSize?: number;
  maxStackSize?: number;
  stackSizeText?: string;
  iconTierText?: string;
  iconStackLevel?: string;
  itemLevel?: number;
  monsterLevel?: number;
  unidentifiedTier?: number;

  // Sockets & Gem data
  sockets?: ItemSocket[];
  gemSockets?: string[]; // PoE2: array of 'W'
  socketedItems?: Item[];
  support?: boolean;
  builtInSupport?: string;
  gemTabs?: GemTab[];
  gemBackground?: string;
  gemSkill?: string;

  // Item Modifiers
  implicitMods?: Array<string | ItemMod>;
  explicitMods?: Array<string | ItemMod>;
  enchantMods?: Array<string | ItemMod>;
  runeMods?: Array<string | ItemMod>;
  utilityMods?: string[];
  scourgeMods?: Array<string | ItemMod>;
  bondedMods?: Array<string | ItemMod>;
  crucibleMods?: Array<string | ItemMod>;
  cosmeticMods?: string[];
  veiledMods?: Array<string | ItemMod>;
  pseudoMods?: Array<string | ItemMod>;

  // Mechanics & League Sub-objects
  properties?: ItemProperty[];
  notableProperties?: ItemProperty[];
  requirements?: ItemProperty[];
  weaponRequirements?: ItemProperty[];
  supportGemRequirements?: ItemProperty[];
  additionalProperties?: ItemProperty[];
  tamedBeastProperties?: ItemProperty[];
  nextLevelRequirements?: ItemProperty[];
  grantedSkills?: ItemProperty[];
  mercenarySkills?: MercenarySkill[];
  logbookMods?: LogbookMod[];
  ultimatumMods?: UltimatumMod[];
  rewards?: ItemRewardGroup[];
  incubatedItem?: IncubatedItemProgress;
  enshrouded?: EnshroudedProgress;
  scourged?: ScourgedProgress;
  crucible?: CrucibleTree;
  hybrid?: HybridGem;
  extended?: ExtendedItemData;

  // Item States & Flags
  corrupted?: boolean;
  doubleCorrupted?: boolean;
  sanctified?: boolean;
  fractured?: boolean;
  synthesised?: boolean;
  duplicated?: boolean;
  split?: boolean;
  veiled?: boolean;
  desecrated?: boolean;
  mutated?: boolean;
  vestigial?: boolean;
  unmodifiable?: boolean;
  unmodifiableExceptChaos?: boolean;
  lockedToCharacter?: boolean;
  lockedToAccount?: boolean;
  ruthless?: boolean;
  isRelic?: boolean;
  replica?: boolean;
  foreseeing?: boolean;
  memoryItem?: boolean;
  abyssJewel?: boolean;
  delve?: boolean;
  foilVariation?: number;

  // Influences
  influences?: ItemInfluences;
  elder?: boolean;
  shaper?: boolean;
  searing?: boolean;
  tangled?: boolean;

  // Race Rewards
  cisRaceReward?: boolean;
  seaRaceReward?: boolean;
  thRaceReward?: boolean;

  // Descriptions & Flavor Notes
  secDescrText?: string;
  descrText?: string;
  flavourText?: string[];
  flavourTextNote?: string;
  prophecyText?: string;
  note?: string;
  forum_note?: string;
}

/**
 * Trade API Wrapper Interfaces
 */
export interface StashPosition {
  name: string;
  x: number;
  y: number;
}

export interface ListingPrice {
  type: string;
  amount: number;
  currency: string;
}

export interface ListingAccount {
  name: string;
  online: boolean | null;
}

export interface ItemListing {
  method: string;
  indexed: string;
  stash: StashPosition;
  price?: ListingPrice;
  fee?: number;
  account: ListingAccount;
  hideout_token?: string;
  whisper_token?: string;
  whisper?: string;
}

export interface TradeFetchResult {
  id: string;
  listing?: ItemListing;
  item: Item;
  gone?: boolean;
}

export interface TradeFetchResponse {
  result: TradeFetchResult[];
}
