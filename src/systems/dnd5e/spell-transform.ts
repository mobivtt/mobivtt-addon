import {isSrdIdentifier} from './srd-registry';

/**
 * Spell detail transformation functions for D&D 5e.
 *
 * Extracts and optimizes spell data from actor items for mobile display.
 * Activities must be read from the live Document (spell.system.activities
 * is an ActivityCollection Map-like), NOT from toObject(false) which returns {}.
 */

interface SpellActivation {
    type: string;
    condition?: string;
}

interface SpellDuration {
    value: number | null;
    units: string;
}

interface SpellRange {
    value: number | null;
    units: string;
}

interface SpellSource {
    book: string;
    page: string;
}

interface SpellTemplate {
    type: string;
    size: number;
    units: string;
}

interface SpellAffects {
    count?: number;
    type: string;
}

interface SpellTarget {
    template?: SpellTemplate;
    affects?: SpellAffects;
}

interface ActivityDamage {
    formula: string;
    types: string[];
}

interface ActivitySummary {
    type: string;
    name: string;
    activation: SpellActivation;
    damage?: ActivityDamage[];
    onSave?: string;
    save?: string[];
    roll?: string;
}

interface SpellDetail {
    name: string;
    img: string;
    level: number;
    school: string;
    identifier: string;
    description: string;
    source: SpellSource;
    activation: SpellActivation;
    duration: SpellDuration;
    range: SpellRange;
    properties: string[];
    activities: ActivitySummary[];
    materials?: string;
    target?: SpellTarget;
}

/** SRD spell reference — identifier only, full details loaded from static source on the website. */
interface SpellReference {
    identifier: string;
}

/**
 * Transform a single activity from a live ActivityCollection entry.
 * Each activity entry must have .toObject(false) called individually.
 */
function transformActivity(activity: any): ActivitySummary {
    const obj = activity.toObject?.(false) ?? activity;

    const result: ActivitySummary = {
        type: obj.type ?? '',
        name: obj.name ?? '',
        activation: {
            type: obj.activation?.type ?? '',
            ...(obj.activation?.condition ? { condition: obj.activation.condition } : {}),
        },
    };

    // Extract damage parts if present
    const damageParts = obj.damage?.parts;
    if (Array.isArray(damageParts) && damageParts.length > 0) {
        const damages: ActivityDamage[] = damageParts
            .filter((part: any) => part.formula)
            .map((part: any) => ({
                formula: part.formula,
                types: Array.isArray(part.types) ? [...part.types] : [],
            }));
        if (damages.length > 0) {
            result.damage = damages;
        }
    }

    // Extract save info
    if (obj.type === 'save' && obj.save?.ability) {
        const abilities = Array.isArray(obj.save.ability) ? [...obj.save.ability] : [obj.save.ability];
        if (abilities.length > 0) {
            result.save = abilities;
        }
    }

    // Half damage on save
    if (obj.damage?.onSave) {
        result.onSave = obj.damage.onSave;
    }

    // Roll formula (e.g. counterspell ability check)
    if (obj.roll?.formula) {
        result.roll = obj.roll.formula;
    }

    return result;
}

/**
 * Transform all activities from a live spell's ActivityCollection.
 * spell.system.activities is a Map-like (ActivityCollection) — iterate with .values().
 */
function transformActivities(liveActivities: any): ActivitySummary[] {
    if (!liveActivities) return [];

    // ActivityCollection is Map-like with .values()
    const entries = typeof liveActivities.values === 'function'
        ? Array.from(liveActivities.values())
        : [];

    return entries.map((activity: any) => transformActivity(activity));
}

/**
 * Transform a single live spell item into a clean SpellDetail for mobile display.
 * The spell parameter must be the live Document (not toObject), so activities can be read.
 */
function transformSpell(spell: any): SpellDetail {
    // Use toObject(false) for the base data (resolves formulas, gives plain values)
    const obj = spell.toObject(false);
    const sys = obj.system ?? {};

    const activation: SpellActivation = {
        type: sys.activation?.type ?? '',
        ...(sys.activation?.condition ? { condition: sys.activation.condition } : {}),
    };

    const properties: string[] = Array.isArray(sys.properties)
        ? [...sys.properties]
        : (sys.properties instanceof Set ? Array.from(sys.properties) : []);

    const result: SpellDetail = {
        name: obj.name ?? '',
        img: obj.img ?? '',
        level: sys.level ?? 0,
        school: sys.school ?? '',
        identifier: sys.identifier ?? '',
        description: sys.description?.value ?? '',
        source: {
            book: sys.source?.book ?? '',
            page: sys.source?.page ?? '',
        },
        activation,
        duration: {
            value: sys.duration?.value ?? null,
            units: sys.duration?.units ?? '',
        },
        range: {
            value: sys.range?.value ?? null,
            units: sys.range?.units ?? '',
        },
        properties,
        // Activities must come from the LIVE document, not toObject
        activities: transformActivities(spell.system?.activities),
    };

    // Only include materials if the spell has a material component
    if (sys.materials?.value) {
        result.materials = sys.materials.value;
    }

    // Build target info — only include non-empty parts
    const target: SpellTarget = {};
    const template = sys.target?.template;
    if (template?.type) {
        target.template = {
            type: template.type,
            size: template.size ?? 0,
            units: template.units ?? 'ft',
        };
    }
    const affects = sys.target?.affects;
    if (affects?.type) {
        target.affects = {
            type: affects.type,
            ...(affects.count != null ? { count: affects.count } : {}),
        };
    }
    if (target.template || target.affects) {
        result.target = target;
    }

    return result;
}

/**
 * Check if a spell originates from an SRD compendium.
 * Matches by identifier against the SRD registry (covers PHB-sourced spells
 * that exist in the SRD), with fallback to source.book.
 */
function isSrdSpell(item: any): boolean {
    const identifier: string = item.system?.identifier ?? '';
    if (isSrdIdentifier(identifier)) return true;

    // Fallback for spells that may lack an identifier but have an SRD source book
    const book: string = item.system?.source?.book ?? '';
    return book.startsWith('SRD');
}

/**
 * Transform all spell items from an actor into a map keyed by system.identifier.
 * SRD spells include only the identifier (the website loads full details from a static reference).
 * Non-SRD spells (homebrew, other compendiums) include full spell details.
 *
 * @param actor The live Actor document (NOT toObject) — needed to access ActivityCollection on each spell.
 */
export function transformActorSpells(actor: any): Record<string, SpellDetail | SpellReference> {
    const spells: Record<string, SpellDetail | SpellReference> = {};

    // actor.items.contents gives live Item documents
    const items = actor.items?.contents ?? [];

    for (const item of items) {
        if (item.type !== 'spell') continue;

        const identifier = item.system?.identifier;
        if (!identifier) continue;

        if (isSrdSpell(item)) {
            // SRD spells — identifier only, website resolves from static reference
            spells[identifier] = { identifier };
            continue;
        }

        try {
            spells[identifier] = transformSpell(item);
        } catch (error) {
            console.warn(`[MobiVTT] Failed to transform spell "${item.name}":`, error);
        }
    }

    return spells;
}
