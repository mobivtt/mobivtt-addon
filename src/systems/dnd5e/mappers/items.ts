/// <reference types="fvtt-types" />
import type {
    CharacterClass, InventoryItem, WeaponEntry, GearEntry,
    ConsumableEntry, CharacterSpell, CharacterFeature, Dnd5eCharacter,
} from '../../../types/character';
import { isSrdIdentifier } from '../srd-registry';
import { stripEnrichedText } from './sanitize';

function applyCommonFields(entry: any, sys: any): void {
    if (sys.weight?.value) entry.weight = { value: sys.weight.value, units: sys.weight.units ?? 'lb' };
    if (sys.price?.value) entry.price = { value: sys.price.value, denomination: sys.price.denomination ?? 'gp' };
    if (sys.rarity) entry.rarity = sys.rarity;
    const props = sys.properties;
    if (props) {
        const arr = props instanceof Set ? [...props] : Array.isArray(props) ? props : [];
        if (arr.length > 0) entry.properties = arr;
    }
}

function resolveSourceBook(sys: any): { book: string; page: string } | undefined {
    if (isSrdIdentifier(sys.identifier)) return { book: 'SRD', page: '' };
    if (sys.source?.book) return { book: sys.source.book, page: sys.source.page ?? '' };
    return undefined;
}

export type ContentFields = Pick<Dnd5eCharacter,
    'classes' | 'race' | 'background' | 'inventory' | 'spells' | 'features'
>;



export function mapContent(resolvedItems: Record<string, any>[], actor: Actor): ContentFields {
    const classes: CharacterClass[] = [];
    const subclassNames = new Map<string, string>();
    const inventory: InventoryItem[] = [];
    const spells: CharacterSpell[] = [];
    const features: CharacterFeature[] = [];
    let race: string | null = null;
    let background: string | null = null;

    // Build a live-item lookup for hasDamage on spells (toObject returns {} for activities)
    const liveSpellMap = new Map<string, any>();
    for (const liveItem of (actor.items as any)?.contents ?? []) {
        if (liveItem.type === 'spell') {
            liveSpellMap.set(liveItem.id, liveItem);
        }
    }

    // First pass: collect subclass names keyed by classIdentifier
    for (const item of resolvedItems) {
        if (item.type === 'subclass') {
            const classId = item.system?.classIdentifier ?? item.system?.identifier;
            if (classId) subclassNames.set(classId, item.name);
        }
    }

    for (const item of resolvedItems) {
        switch (item.type) {
            case 'class':
                classes.push(mapClass(item, subclassNames));
                break;
            case 'race':
                race = (item.name ?? '').replace(/;\s*/g, ' (') + (item.name?.includes(';') ? ')' : '') || null;
                break;
            case 'background':
                background = item.name ?? null;
                break;
            case 'weapon':
                inventory.push(mapWeapon(item));
                break;
            case 'equipment':
            case 'container':
            case 'loot':
                inventory.push(mapGear(item));
                break;
            case 'consumable':
                inventory.push(mapConsumable(item));
                break;
            case 'spell':
                spells.push(mapSpellEntry(item, liveSpellMap.get(item._id)));
                break;
            case 'feat':
                features.push(mapFeature(item));
                break;
        }
    }

    return { classes, race, background, inventory, spells, features };
}

function mapClass(item: Record<string, any>, subclassNames: Map<string, string>): CharacterClass {
    const sys = item.system ?? {};
    const identifier = sys.identifier ?? '';
    const result: CharacterClass = {
        _id: item._id,
        name: item.name,
        levels: sys.levels ?? 0,
        hitDie: {
            denomination: sys.hd?.denomination ?? 'd8',
            spent: sys.hd?.spent ?? 0,
        },
    };
    if (identifier) {
        result.identifier = identifier;
        const sub = subclassNames.get(identifier);
        if (sub) result.subclass = sub;
    }
    return result;
}

function mapWeapon(item: Record<string, any>): WeaponEntry {
    const sys = item.system ?? {};
    const entry: WeaponEntry = {
        category: 'weapon',
        name: item.name,
        _id: item._id,
        quantity: sys.quantity ?? 1,
        weaponType: sys.type?.value ?? '',
    };
    if (sys.identifier) entry.identifier = sys.identifier;
    if (sys.magicalBonus != null) entry.magicalBonus = sys.magicalBonus;

    if (sys.description?.value) entry.description = stripEnrichedText(sys.description.value);
    const srcBook = resolveSourceBook(sys); if (srcBook) entry.sourceBook = srcBook;
    applyCommonFields(entry, sys);
    if (sys.damage?.base) {
        entry.damage = {
            number: sys.damage.base.number ?? null,
            denomination: sys.damage.base.denomination ?? null,
            types: Array.isArray(sys.damage.base.types) ? [...sys.damage.base.types] : [],
        };
    }
    if (sys.range) {
        entry.range = {
            value: sys.range.value ?? null,
            units: sys.range.units ?? 'ft',
            ...(sys.range.long != null ? { long: sys.range.long } : {}),
        };
    }
    return entry;
}

function mapGear(item: Record<string, any>): GearEntry {
    const sys = item.system ?? {};
    const entry: GearEntry = {
        category: 'gear',
        name: item.name,
        _id: item._id,
        quantity: sys.quantity ?? 1,
    };
    if (sys.identifier) entry.identifier = sys.identifier;
    if (sys.description?.value) entry.description = stripEnrichedText(sys.description.value);
    const srcBook1 = resolveSourceBook(sys); if (srcBook1) entry.sourceBook = srcBook1;
    applyCommonFields(entry, sys);
    return entry;
}

function mapConsumable(item: Record<string, any>): ConsumableEntry {
    const sys = item.system ?? {};
    const entry: ConsumableEntry = {
        category: 'consumable',
        name: item.name,
        _id: item._id,
        quantity: sys.quantity ?? 1,
    };
    if (sys.identifier) entry.identifier = sys.identifier;
    if (sys.description?.value) entry.description = stripEnrichedText(sys.description.value);
    const srcBook2 = resolveSourceBook(sys); if (srcBook2) entry.sourceBook = srcBook2;
    applyCommonFields(entry, sys);
    return entry;
}

function mapSpellEntry(item: Record<string, any>, liveItem: any): CharacterSpell {
    const sys = item.system ?? {};
    const prepValue = sys.prepared ?? 0;
    const entry: CharacterSpell = {
        name: item.name,
        _id: item._id,
        level: sys.level ?? 0,
        preparation: {
            mode: liveItem?.system?.preparation?.mode ?? sys.method ?? 'spell',
            prepared: prepValue >= 1,
        },
        range: {
            value: sys.range?.value ?? null,
            units: sys.range?.units ?? '',
        },
    };
    if (sys.identifier) entry.identifier = sys.identifier;
    if (sys.activation?.type) entry.activationType = sys.activation.type;
    if (sys.sourceItem) entry.sourceItem = sys.sourceItem;

    // hasDamage from live item (toObject returns {} for ActivityCollection)
    const liveActivities = liveItem?.system?.activities;
    if (liveActivities && typeof liveActivities.values === 'function') {
        entry.hasDamage = Array.from(liveActivities.values()).some((act: any) =>
            act.type === 'attack' || ((act.damage?.parts?.length ?? 0) > 0)
        );
    }

    return entry;
}

function mapFeature(item: Record<string, any>): CharacterFeature {
    const sys = item.system ?? {};
    const typeValue: string = sys.type?.value ?? '';

    let source: CharacterFeature['source'];
    if (typeValue === 'race') source = 'race';
    else if (typeValue === 'feat') source = 'feat';
    else source = 'class';

    const entry: CharacterFeature = {
        name: item.name,
        _id: item._id,
        source,
        requirements: (sys.requirements ?? '').replace(/;\s*/g, ' (') + (sys.requirements?.includes(';') ? ')' : ''),
    };
    if (sys.identifier) entry.identifier = sys.identifier;
    if (sys.description?.value) entry.description = stripEnrichedText(sys.description.value);
    const srcBook3 = resolveSourceBook(sys); if (srcBook3) entry.sourceBook = srcBook3;

    if (sys.uses && sys.uses.max !== '' && sys.uses.max != null) {
        const recovery = Array.isArray(sys.uses.recovery)
            ? sys.uses.recovery.filter((r: any) => r?.period).map((r: any) => ({ period: r.period }))
            : [];
        entry.uses = {
            spent: sys.uses.spent ?? 0,
            max: sys.uses.max,
            recovery,
        };
    }

    return entry;
}
