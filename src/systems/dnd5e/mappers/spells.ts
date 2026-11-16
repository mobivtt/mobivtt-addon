/// <reference types="fvtt-types" />
import type { SpellDetail, SpellReference, ActivitySummary, SpellTarget } from '../../../types/character';
import { stripEnrichedText } from './sanitize';
import { isSrdIdentifier } from '../srd-registry';

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

    const damageParts = obj.damage?.parts;
    if (Array.isArray(damageParts) && damageParts.length > 0) {
        const damages = damageParts
            .filter((part: any) => part.formula)
            .map((part: any) => ({
                formula: part.formula,
                types: Array.isArray(part.types) ? [...part.types] : [],
            }));
        if (damages.length > 0) {
            result.damage = damages;
        }
    }

    if (obj.type === 'save' && obj.save?.ability) {
        const abilities = Array.isArray(obj.save.ability) ? [...obj.save.ability] : [obj.save.ability];
        if (abilities.length > 0) {
            result.save = abilities;
        }
    }

    if (obj.damage?.onSave) {
        result.onSave = obj.damage.onSave;
    }

    if (obj.roll?.formula) {
        result.roll = obj.roll.formula;
    }

    return result;
}

function transformActivities(liveActivities: any): ActivitySummary[] {
    if (!liveActivities) return [];

    const entries = typeof liveActivities.values === 'function'
        ? Array.from(liveActivities.values())
        : [];

    return entries.map((activity: any) => transformActivity(activity));
}

function transformSpell(spell: any): SpellDetail {
    const obj = spell.toObject?.(false) ?? spell;
    const sys = obj.system ?? {};

    const properties: string[] = Array.isArray(sys.properties)
        ? [...sys.properties]
        : (sys.properties instanceof Set ? Array.from(sys.properties) : []);

    const result: SpellDetail = {
        name: obj.name ?? '',
        img: obj.img ?? '',
        level: sys.level ?? 0,
        school: sys.school ?? '',
        identifier: sys.identifier ?? '',
        description: stripEnrichedText(sys.description?.value ?? ''),
        source: isSrdIdentifier(sys.identifier)
            ? { book: 'SRD', page: '' }
            : { book: sys.source?.book ?? '', page: sys.source?.page ?? '' },
        activation: {
            type: sys.activation?.type ?? '',
            ...(sys.activation?.condition ? { condition: sys.activation.condition } : {}),
        },
        duration: {
            value: sys.duration?.value ?? null,
            units: sys.duration?.units ?? '',
        },
        range: {
            value: sys.range?.value ?? null,
            units: sys.range?.units ?? '',
        },
        properties,
        activities: transformActivities(spell.system?.activities),
    };

    if (sys.materials?.value) {
        result.materials = sys.materials.value;
    }

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

export function mapSpellDetails(
    actor: Actor,
    translations?: Map<string, { name: string; description: string }>,
): Record<string, SpellDetail | SpellReference> {
    const spells: Record<string, SpellDetail | SpellReference> = {};
    const items = (actor.items as any)?.contents ?? [];

    for (const item of items) {
        if (item.type !== 'spell') continue;

        const identifier = item.system?.identifier;
        if (!identifier) continue;

        try {
            const t = translations?.get(item.id ?? item._id);
            const patched = t ? patchItem(item, t) : item;
            spells[identifier] = transformSpell(patched);
        } catch (error) {
            console.warn(`[MobiVTT] Failed to transform spell "${item.name}":`, error);
        }
    }

    return spells;
}

function patchItem(item: any, t: { name: string; description: string }): any {
    const obj = item.toObject?.(false) ?? item;
    return {
        ...obj,
        name: t.name,
        system: {
            ...obj.system,
            description: { ...obj.system?.description, value: t.description },
        },
    };
}
