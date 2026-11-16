/// <reference types="fvtt-types" />

/**
 * Module-agnostic compendium translation for actor items.
 *
 * Lookup chain per item:
 *   1. sourceUuid (flags.dnd5e.sourceId → _stats.compendiumSource) → fromUuid()
 *   2. system.identifier → pack index search across relevant packs
 *   3. null (caller falls back to English original)
 *
 * Works with Babele, custom translated compendiums, or any module that
 * patches pack documents at runtime.  Zero dependency on any specific
 * translation module's API.
 */

const PACKS_BY_TYPE: Record<string, string[]> = {
    spell:      ['dnd5e.spells24', 'dnd5e.spells'],
    weapon:     ['dnd5e.items', 'dnd5e.equipment24'],
    equipment:  ['dnd5e.items', 'dnd5e.equipment24'],
    consumable: ['dnd5e.items', 'dnd5e.equipment24'],
    loot:       ['dnd5e.items', 'dnd5e.equipment24'],
    container:  ['dnd5e.items', 'dnd5e.equipment24'],
    tool:       ['dnd5e.items', 'dnd5e.equipment24'],
    feat:       ['dnd5e.classfeatures', 'dnd5e.feats24'],
    class:      ['dnd5e.classes24', 'dnd5e.classes'],
    subclass:   ['dnd5e.subclasses'],
    race:       ['dnd5e.origins24', 'dnd5e.races'],
    background: ['dnd5e.backgrounds'],
};

export interface TranslatedFields {
    name: string;
    description: string;
}

type PackIndex = Map<string, string>;
const indexCache = new Map<string, PackIndex>();
const resultCache = new Map<string, TranslatedFields>();

async function getPackIndex(packName: string): Promise<PackIndex> {
    const cached = indexCache.get(packName);
    if (cached) return cached;

    const pack = (game as any).packs.get(packName);
    if (!pack) return new Map();

    const index = await pack.getIndex({ fields: ['system.identifier'] } as any);
    const map: PackIndex = new Map();
    for (const entry of index) {
        const id = (entry as any).system?.identifier;
        if (id) map.set(id, entry._id);
    }

    indexCache.set(packName, map);
    return map;
}

async function resolveFromSource(item: any): Promise<TranslatedFields | null> {
    const sourceUuid: string | undefined =
        item.flags?.dnd5e?.sourceId ?? item._stats?.compendiumSource;
    if (!sourceUuid || !sourceUuid.startsWith('Compendium.')) return null;

    // Plutonium-imported items use fake compendium UUIDs (e.g. "Compendium.plutonium-faux-id--...")
    // that trigger Plutonium's patched fromUuid() to re-import the item as a world-level document.
    // These items already carry translated names baked in at import time (via Babele integration),
    // so resolving them is both redundant and harmful.
    if (sourceUuid.includes('plutonium-faux-id')) return null;

    try {
        const doc = await (globalThis as any).fromUuid(sourceUuid);
        if (!doc) return null;
        return {
            name: doc.name ?? '',
            description: doc.system?.description?.value ?? '',
        };
    } catch {
        return null;
    }
}

async function resolveFromIdentifier(item: any): Promise<TranslatedFields | null> {
    const identifier: string | undefined = item.system?.identifier;
    const type: string | undefined = item.type;
    if (!identifier || !type) return null;

    const cacheKey = `${type}:${identifier}`;
    const cached = resultCache.get(cacheKey);
    if (cached) return cached;

    const packNames = PACKS_BY_TYPE[type];
    if (!packNames) return null;

    for (const packName of packNames) {
        const index = await getPackIndex(packName);
        const docId = index.get(identifier);
        if (!docId) continue;

        const pack = (game as any).packs.get(packName);
        if (!pack) continue;

        try {
            const doc = await pack.getDocument(docId) as any;
            if (!doc) continue;

            const result: TranslatedFields = {
                name: doc.name ?? '',
                description: doc.system?.description?.value ?? '',
            };
            resultCache.set(cacheKey, result);
            return result;
        } catch {
            continue;
        }
    }

    return null;
}

async function translateSingleItem(item: any): Promise<TranslatedFields | null> {
    return await resolveFromSource(item) ?? await resolveFromIdentifier(item);
}

export async function translateItems(
    items: any[],
): Promise<Map<string, TranslatedFields>> {
    const results = await Promise.all(
        items.map(async (item) => {
            const id = item.id ?? item._id;
            const translation = await translateSingleItem(item);
            return (id && translation) ? [id as string, translation] as const : null;
        }),
    );

    const map = new Map<string, TranslatedFields>();
    for (const entry of results) {
        if (entry) map.set(entry[0], entry[1]);
    }
    return map;
}

export interface SkillTranslation {
    label: string;
    description: string;
}

let skillCache: Map<string, SkillTranslation> | null = null;

export async function translateSkills(): Promise<Map<string, SkillTranslation>> {
    if (skillCache) return skillCache;

    const skills = (CONFIG as any).DND5E?.skills;
    if (!skills) return new Map();

    const entries = await Promise.all(
        Object.entries(skills).map(async ([key, cfg]: [string, any]) => {
            const label = cfg.label ?? key;
            let description = '';

            if (cfg.reference) {
                try {
                    const doc = await (globalThis as any).fromUuid(cfg.reference);
                    if (doc?.text?.content) {
                        description = doc.text.content;
                    }
                } catch { /* compendium not loaded yet */ }
            }

            return [key, { label, description }] as const;
        }),
    );

    skillCache = new Map(entries);
    return skillCache;
}

export interface ConditionTranslation {
    label: string;
    description: string;
}

let conditionCache: Map<string, ConditionTranslation> | null = null;

export async function translateConditions(): Promise<Map<string, ConditionTranslation>> {
    if (conditionCache) return conditionCache;

    const conditionTypes = (CONFIG as any).DND5E?.conditionTypes;
    if (!conditionTypes) return new Map();

    const entries = await Promise.all(
        Object.entries(conditionTypes)
            .filter(([, cfg]: [string, any]) => !cfg.pseudo)
            .map(async ([key, cfg]: [string, any]) => {
                const label = cfg.label ?? cfg.name ?? key;
                let description = '';

                if (cfg.reference) {
                    try {
                        const doc = await (globalThis as any).fromUuid(cfg.reference);
                        if (doc?.text?.content) description = doc.text.content;
                    } catch { /* compendium not loaded */ }
                }

                return [key, { label, description }] as const;
            }),
    );

    conditionCache = new Map(entries);
    return conditionCache;
}

export function buildI18nLabels(): Record<string, any> {
    const i18n = (game as any).i18n;
    const cfg = (CONFIG as any).DND5E;
    const l = (key: string): string => {
        const v = i18n.localize(key);
        return v === key ? '' : v;
    };
    const extract = (obj: any): Record<string, string> =>
        Object.fromEntries(
            Object.entries(obj ?? {}).map(([k, v]: [string, any]) => [k, typeof v === 'string' ? v : v?.label ?? k]),
        );

    return {
        castingTime: l('DND5E.CastingTime') || l('DND5E.SpellCastTime') || 'Casting Time',
        range: l('DND5E.Range') || 'Range',
        duration: l('DND5E.Duration') || 'Duration',
        components: l('DND5E.SpellComponents') || l('DND5E.Components') || 'Components',
        materials: l('DND5E.SpellMaterials') || 'Materials',
        concentration: l('DND5E.Concentration') || 'Concentration',
        weight: l('DND5E.Weight') || 'Weight',
        price: l('DND5E.Price') || 'Price',
        damage: l('DND5E.Damage') || 'Damage',
        armorClass: l('DND5E.ArmorClass') || 'Armor Class',
        properties: l('DND5E.Properties') || 'Properties',
        ability: l('DND5E.Ability') || 'Ability',
        requirements: l('DND5E.Requirements') || 'Requirements',
        cantrip: l('DND5E.SpellCantrip') || 'Cantrip',
        level: l('DND5E.Level') || l('DND5E.SpellLevel') || 'Level',
        none: l('DND5E.None') || 'None',
        schools: extract(cfg.spellSchools),
        activationTypes: extract(cfg.activityActivationTypes ?? cfg.abilityActivationTypes),
        itemProperties: extract(cfg.itemProperties),
        rarities: extract(cfg.itemRarity),
    };
}

export function clearTranslationCache(): void {
    indexCache.clear();
    resultCache.clear();
    skillCache = null;
    conditionCache = null;
}
