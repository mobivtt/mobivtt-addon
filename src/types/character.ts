// AUTO-SYNCED from mobivtt/src/types/character.ts — do not edit directly. Run sync-types.sh to update.
// =============================================================================
// Dnd5eCharacter — D&D 5e Character Payload
//
// MobiVTT's own data spec. Structure mirrors what the website renders,
// not FoundryVTT's internal data model. The addon mapper translates
// Foundry actor data into this shape.
//
// Principles:
// - Grouped by display purpose, not by game system internals
// - No flat "items" array — content pre-grouped by section
// - Identity data (race, background, classes) are first-class fields
// - No `any` types, no D&D 5e item type system leaking
// =============================================================================


// --- Literal Types --------------------------------------------------------

export type AbilityId = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export type SkillId =
  | 'acr' | 'ani' | 'arc' | 'ath' | 'dec' | 'his'
  | 'ins' | 'itm' | 'inv' | 'med' | 'nat' | 'prc'
  | 'prf' | 'per' | 'rel' | 'slt' | 'ste' | 'sur'


export interface CharacterI18n {
  castingTime: string
  range: string
  duration: string
  components: string
  materials: string
  concentration: string
  weight: string
  price: string
  damage: string
  armorClass: string
  properties: string
  ability: string
  requirements: string
  cantrip: string
  level: string
  none: string
  schools: Record<string, string>
  activationTypes: Record<string, string>
  itemProperties: Record<string, string>
  rarities: Record<string, string>
}

// --- Root Payload ---------------------------------------------------------

export interface Dnd5eCharacter {
  // -- Identity --
  name: string
  level: number
  classes: CharacterClass[]
  race: string | null
  background: string | null

  // -- Core Stats --
  abilities: Record<AbilityId, Ability>
  skills: Record<SkillId, Skill>

  // -- Combat --
  hp: HitPoints
  ac: number
  initiative: number
  proficiencyBonus: number
  inspiration: boolean
  deathSaves: DeathSaves
  movement: Movement
  size: string
  passivePerception: number

  // -- Conditions --
  conditions: ConditionInfo[]
  /** Exhaustion level (0-6) */
  exhaustion: number

  // -- Spellcasting --
  /** null if character has no spellcasting */
  spellcasting: SpellcastingInfo | null
  /** Keyed by level (1-9). Only levels with max > 0 present. */
  spellSlots: Record<number, SpellSlot>
  pactSlot?: PactSlot

  // -- Economy --
  currency: Currency
  resources: CharacterResources

  // -- Character Info --
  details: CharacterDetails
  proficiencies: Proficiencies

  // -- Content (grouped by display section) --
  inventory: InventoryItem[]
  spells: CharacterSpell[]
  features: CharacterFeature[]

  spellDetails?: Record<string, SpellDetail | SpellReference>
  i18n?: CharacterI18n
}


// ==========================================================================
// Identity
// ==========================================================================

export interface CharacterClass {
  _id: string
  name: string
  identifier?: string
  levels: number
  subclass?: string
  hitDie: { denomination: string; spent: number }
}


// ==========================================================================
// Core Stats
// ==========================================================================

export interface Ability {
  label: string
  value: number
  mod: number
  /** 0 = none, 1 = proficient */
  saveProficient: number
  /** Saving throw total bonus */
  save: number
  /** Melee/ranged attack bonus. Present on str and dex. */
  attack?: number
}

export interface Skill {
  label: string
  description?: string
  ability: AbilityId
  /** 0 = none, 0.5 = half, 1 = proficient, 2 = expertise */
  proficient: number
  total: number
  /** Passive score. Present on prc (Perception). */
  passive?: number
}


export interface ConditionInfo {
  id: string
  label: string
  description: string
}

// ==========================================================================
// Combat
// ==========================================================================

export interface HitPoints {
  value: number
  max: number
  temp: number
}

export interface DeathSaves {
  success: number
  failure: number
}

export interface Movement {
  walk: number
  fly: number
  swim: number
  climb: number
  burrow: number
}


// ==========================================================================
// Spellcasting
// ==========================================================================

export interface SpellcastingInfo {
  ability: AbilityId
  attack: number
  dc: number
  mod: number
  maxPrepared: number | null
}

export interface SpellSlot {
  value: number
  max: number
}

export interface PactSlot extends SpellSlot {
  level: number
}


// ==========================================================================
// Economy & Resources
// ==========================================================================

export interface Currency {
  pp: number
  gp: number
  ep: number
  sp: number
  cp: number
}

export interface CharacterResources {
  primary: Resource
  secondary: Resource
  tertiary: Resource
}

export interface Resource {
  value: number
  max: number
  label: string
  sr: boolean
  lr: boolean
}


// ==========================================================================
// Character Details & Proficiencies
// ==========================================================================

export interface CharacterDetails {
  alignment: string
  creatureType: string
  /** Backstory / biography (HTML) */
  biography: string
  trait: string
  ideal: string
  bond: string
  flaw: string
}

export interface Proficiencies {
  weapons: string[]
  armor: string[]
  languages: string[]
  tools: Record<string, { total: number }>
}


// ==========================================================================
// Inventory (physical carried items)
// ==========================================================================

export type InventoryItem = WeaponEntry | GearEntry | ConsumableEntry

interface InventoryBase {
  name: string
  _id: string
  identifier?: string
  quantity: number
  description?: string
  sourceBook?: { book: string; page: string }
  weight?: { value: number; units: string }
  price?: { value: number; denomination: string }
  properties?: string[]
  rarity?: string
}

/** Attack-capable item with damage/range data */
export interface WeaponEntry extends InventoryBase {
  category: 'weapon'
  weaponType: string
  magicalBonus?: number | null
  /** Absent for SRD items (resolved from reference) */
  damage?: {
    number: number | null
    denomination: number | string | null
    types: string[]
  }
  range?: {
    value: number | null
    long?: number | null
    units: string
  }
}

/** Equipment, containers, loot */
export interface GearEntry extends InventoryBase {
  category: 'gear'
}

/** Expendable items */
export interface ConsumableEntry extends InventoryBase {
  category: 'consumable'
}


// ==========================================================================
// Spells
// ==========================================================================

export interface CharacterSpell {
  name: string
  _id: string
  identifier?: string
  level: number
  activationType?: string
  preparation: { mode: string; prepared: boolean }
  range: { value: number | null; units: string }
  /** True if spell deals damage (used by Attacks to list damage cantrips) */
  hasDamage?: boolean
  /** Origin of the spell, e.g. "equipment:cube-of-summoning", "class:ranger", "race:elf-drow-lineage" */
  sourceItem?: string
}


// ==========================================================================
// Features (class abilities, racial traits, character feats)
// ==========================================================================

export interface CharacterFeature {
  name: string
  _id: string
  identifier?: string
  /** Where this feature comes from */
  source: 'class' | 'race' | 'feat'
  /** Grouping text (e.g., "Bard 3 (Eloquence)", "Human") */
  requirements: string
  uses?: FeatureUses
  /** HTML description — present for non-SRD content only */
  description?: string
  /** Publication source — present for non-SRD content only */
  sourceBook?: { book: string; page: string }
}

export interface FeatureUses {
  spent: number
  max: number | string
  recovery: Array<{ period: string }>
}


// ==========================================================================
// Spell Details (non-SRD spells get full data in payload)
// ==========================================================================

export interface SpellDetail {
  name: string
  img: string
  level: number
  school: string
  identifier: string
  description: string
  source: { book: string; page: string }
  activation: { type: string; condition?: string }
  duration: { value: number | null; units: string }
  range: { value: number | null; units: string }
  properties: string[]
  activities: ActivitySummary[]
  materials?: string
  target?: SpellTarget
}

/** SRD spell reference — identifier only, website resolves from static data */
export interface SpellReference {
  identifier: string
}

export interface ActivitySummary {
  type: string
  name: string
  activation: { type: string; condition?: string }
  damage?: Array<{ formula: string; types: string[] }>
  onSave?: string
  save?: string[]
  roll?: string
}

export interface SpellTarget {
  template?: { type: string; size: number; units: string }
  affects?: { count?: number; type: string }
}
