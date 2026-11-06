const propertyType = new Map<number, string>([
  [1, "map_tier"],
  [2, "map_iiq"], // Item Quantity
  [3, "map_iir"], // Item Rarity
  [4, "map_packsize"], // Monster Pack Size || Maximum Alive Reinforcements
  [5, "gem_level"], // Level
  [6, "quality"], // Quality
  [7, ""],
  [8, ""],
  [9, "pdamage"], // Physical Damage
  [10, "edamage"], // Elemental Damage
  [11, "cdamage"], // chaos damage
  [12, "crit"], // Critical Strike Chance
  [13, "aps"], // Attacks per Second
  [14, ""], // Weapon Range
  [15, "block"], // Block chance
  [16, "ar"], // Armour
  [17, "ev"], // Evasion Rating
  [18, "es"], // Energy Shield
  [19, ""],
  [20, "gem_level_progress"], // Expirience (gem)

  // Einhar
  [21, ""], // Genus
  [22, ""], // Group
  [23, ""], // Family

  [24, ""],
  [25, "spirit"], // Spirit
  [26, ""],
  [27, ""], // Number of Trials
  [28, ""], // Notable
  [29, ""],
  [30, "monster_level"],
  [31, "stored_experience"],
  [32, "stack_size"],
  [33, "durability"],
  [34, "area_level"], // Area Level
  [35, "heist_wings"],
  [36, "heist_escape_routes"],
  [37, "heist_reward_rooms"],
  // heist requirments
  [38, "heist_lockpicking"],
  [39, "heist_brute_force"],
  [40, "heist_perception"],
  [41, "heist_demolition"],
  [42, "heist_counter_thaumaturgy"],
  [43, "heist_trap_disarmament"],
  [44, "heist_agility"],
  [45, "heist_deception"],
  [46, "heist_engineering"],
  [47, "heist_objective_value"], // Heist Target
  [48, ""],
  [49, ""],
  [50, ""],
  // Inscribed Ultimatum
  [51, ""], // Requires Sacrifice
  [52, ""], // Reward

  [53, ""],
  [54, "ward"], // Ward
  [55, "adaptation"],
  [56, ""],
  [57, ""], // Class (forbidden flesh and flame) [non-sort]
  [58, "sentinel_durability"],
  [59, "sentinel_duration"],
  [60, "sentinel_empowerment_limit"],
  [61, "sentinel_empowerment"],
  // Requirments
  [62, "lvl"], // Level
  [63, "str"], // str
  [64, "dex"], // dex
  [65, "int"], // int

  [66, "map_bonus"], // Waystone Drop Chance
  [67, ""],
  [68, "sanctum_resolve"], // Resolve
  [69, "sanctum_inspiration"], // Inspiration
  [70, "sanctum_gold"], // Aureus || Sacred Water
  [71, ""], // Minor Boons
  [72, ""], // Major Boons
  [73, ""], // Minor Afflictions
  [74, ""], // Major Afflictions
  [75, ""],
  [76, ""], // Reward (valdo map)
  [77, ""], // Chance for dropped map to convert to (has no value, just the text)
  [78, "ilvl"], // Corpse Level || mercenrary Level
  [79, ""], // Monsterr Cathegory

  // Valdo Map convert to chances
  [80, "stat.pseudo.pseudo_map_conversion_shaper_map"], // Shaper Map
  [81, "stat.pseudo.pseudo_map_conversion_elder_map"], // Elder Map
  [82, "stat.pseudo.pseudo_map_conversion_conqueror_map"], // Conquerror Map
  [83, "stat.pseudo.pseudo_map_conversion_unique_map"], // Unique Map
  [84, "stat.pseudo.pseudo_map_conversion_scarab"], // Scarab
  [85, "stat.pseudo.pseudo_map_conversion_maven_invitation"], // Maven Invitation
  [86, "stat.pseudo.pseudo_map_conversion_memory_line"], // Memory line
  [87, ""],
  [88, "stat.pseudo.pseudo_map_more_map_drops"], // More Maps
  [89, "stat.pseudo.pseudo_map_more_scarab_drops"],
  [90, "stat.pseudo.pseudo_map_more_currency_drops"], // More Currency
  [91, "stat.pseudo.pseudo_map_more_card_drops"],
  [92, ""],
  [93, ""],
  [94, ""],
  [95, ""],
  [96, ""], // Weapon Requirment (eg. requires spear)
  [97, "reload_time"], // Reload Time
  [98, "map_revives"], // Revives Aviable (poe2 map)
  [99, "memory_level"], // Memory Strand
  [100, "map_gold"],
  [101, "map_experience"],
  [102, "map_magic_monsters"], // Monster Effectiveness
  [103, "map_rare_monsters"], // Monster Rarity
  [104, ""],
  [105, ""], // Map Area
  [106, "stat.pseudo.pseudo_ritual_unique_monsters"],
  [107, "stat.pseudo.pseudo_ritual_other_monsters"],
  [108, ""],
  [109, ""], // some base types, found it on Amulet, Jewel and Scepther in poe2
  [110, "intangibility"], // Intangibility
  [111, "chart_sulphur"], // Dead Mans Sulfur
  [112, ""],
  [113, ""],
  [114, ""],
  [115, ""],
]);
export const sortOptions = new Map<string, string>([
  ["price", "Buyout Price"],

  // damage
  ["damage", "Damage"],
  ["pdamage", "Physical Damage"],
  ["edamage", "Elemental Damage"],
  ["dps", "DPS"],
  ["pdps", "Physical DPS"],
  ["edps", "Elemental DPS"],
  ["cdamage", "Chaos Damage"],
  ["crit", "Crit Chance"],
  ["aps", "Attacks per Second"],

  ["quality", "quality"],
  ["stack_size", "Stack Size"],

  // Defenses
  ["ar", "Armour"],
  ["ev", "Evasion Rating"],
  ["es", "Energy Shield"],
  ["ward", "Ward"],
  ["adaptation", "Adaptation"],
  ["spirit", "Spirit"],
  ["base_defence_percentile", "Base Def %"],

  //gem
  ["ilvl", "Item Level"],
  ["gem_level", "gem_level"],
  ["stored_experience", "Stored Expirience"],
  ["gem_level_progress", "Expirience % Progress"],
  // map
  ["area_level", "Area Level"],
  ["monster_level", "Monster Level"],
  ["map_tier", "Map Tier"],
  ["map_iiq", "Inc Item Quantity"],
  ["map_iir", "Inc Item Rarity"],
  ["map_packsize", "Pack Size"],
  ["map_bonus", "Waystone Drop Chance"],
  ["map_gold", "Map GOld"],
  ["map_experience", "Map Expirience"],
  ["map_magic_monsters", "Monster Effectivness"], // Monster Effectiveness
  ["map_rare_monsters", "Monster Rarity"], // Monster Rarity
  ["map_revives", "Map Revives"], // Monster Rarity
  ["chart_sulphur", "Deadmans Sulfur"], // Monster Rarity

  ["memory_level", "Memory Strands"],
  ["intangibility", "Intangibility"],
  ["scourge_tier", "Scourage Tier"],
  // Sanctum
  ["sanctum_resolve", "Resolve"], // Resolve
  ["sanctum_max_resolve", "Max Resolve"], // Resolve
  ["sanctum_inspiration", "Inspiration"], // Inspiration
  ["sanctum_gold", "Aureus"], // Aureus || Sacred Water
  // Heist
  ["heist_wings", "Heist Wings"],
  ["heist_escape_routes", "Heist Escape Routes"],
  ["heist_reward_rooms", "Heist Reward Rooms"],
  ["heist_lockpicking", " Heist Lockpicking Level"],
  ["heist_brute_force", "Heist Brute Force Level"],
  ["heist_perception", "Heist Perception Level"],
  ["heist_demolition", "Heist Demolition Level"],
  ["heist_counter_thaumaturgy", "Heist Traumaturgy Level"],
  ["heist_trap_disarmament", "Heist Disarment Level"],
  ["heist_agility", "Heist Agility Level"],
  ["heist_deception", "Heist Deception Level"],
  ["heist_engineering", "Heist Engineering Level"],
  ["heist_objective_value", "Heist Objective Value"],
  ["durability", "?Durability?"],
  // Sentinel XDDD
  ["sentinel_durability", "Sentinel Durability"],
  ["sentinel_duration", "Sentinel Duration"],
  ["sentinel_empowerment", "Sentinel Empowerment"],
  ["sentinel_empowerment_limit", "Sentinel Empowerment Limit"],
  // Requirments
  ["lvl", "Level Requirment"],
  ["int", "Int Requirment"],
  ["dex", "Dex Requirment"],
  ["str", "Str Requirment"],

  // listing
  ["fee", "Gold Fee"],
  ["indexed", "Time Indexed"],
]);
export const sortOptions2 = new Map<string, string>([
  ["price", "Buyout Price"],

  // damage
  ["damage", "Damage"],
  ["pdamage", "Physical Damage"],
  ["edamage", "Elemental Damage"],
  ["dps", "DPS"],
  ["pdps", "Physical DPS"],
  ["edps", "Elemental DPS"],
  ["cdamage", "Chaos Damage"],
  ["crit", "Crit Chance"],
  ["aps", "Attacks per Second"],
  ["reload_time", "Reload Time"],

  ["quality", "quality"],
  ["stack_size", "Stack Size"],

  // Defenses
  ["ar", "Armour"],
  ["ev", "Evasion Rating"],
  ["es", "Energy Shield"],
  ["ward", "Ward"],
  ["adaptation", "Adaptation"],
  ["spirit", "Spirit"],
  ["rune_sockets", "Aviable Rune Sockets"],
  ["total_augment_sockets", "Total Rune Sockets"],

  //gem
  ["ilvl", "Item Level"],
  ["gem_level", "gem_level"],
  ["unidentified_tier", "Unidentified Tier"],
  // map
  ["area_level", "Area Level"],
  ["monster_level", "Monster Level"],
  ["map_tier", "Map Tier"],
  ["map_iiq", "Inc Item Quantity"],
  ["map_iir", "Inc Item Rarity"],
  ["map_packsize", "Pack Size"],
  ["map_bonus", "Waystone Drop Chance"],
  ["map_gold", "Map GOld"],
  ["map_experience", "Map Expirience"],
  ["map_magic_monsters", "Monster Effectivness"], // Monster Effectiveness
  ["map_rare_monsters", "Monster Rarity"], // Monster Rarity
  ["map_revives", "Map Revives"], // Monster Rarity

  // Sanctum
  ["sanctum_resolve", "Honor"], // Resolve
  ["sanctum_max_resolve", "Max Honor"], // Resolve
  ["sanctum_inspiration", "Inspiration"], // Inspiration
  ["sanctum_gold", "Sacred Water"], // Aureus || Sacred Water

  // Requirments
  ["lvl", "Level Requirment"],
  ["int", "Int Requirment"],
  ["dex", "Dex Requirment"],
  ["str", "Str Requirment"],

  // listing
  ["fee", "Gold Fee"],
  ["indexed", "Time Indexed"],
]);
