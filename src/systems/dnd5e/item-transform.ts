/**
 * Item transformation for SRD filtering on actor export.
 *
 * SRD items are stripped to identifier + character-specific state.
 * Non-SRD items (homebrew, etc.) are kept as-is from toObject(false).
 *
 * Character-specific state preserved for SRD items:
 *   Physical items: _id, name, type, img, identifier, quantity, equipped, attuned, container, uses
 *   Features:       _id, name, type, img, identifier, feat type, uses
 *   Classes:        _id, name, type, img, identifier, levels, hd, spellcasting
 *   Subclasses:     _id, name, type, img, identifier, classIdentifier, spellcasting
 *   Background/Race: _id, name, type, img, identifier
 */
import {isSrdIdentifier} from './srd-registry';

/** Item types that carry physical inventory state. */
const PHYSICAL_ITEM_TYPES = ['weapon', 'equipment', 'consumable', 'container', 'loot'] as const;

/**
 * Check if an item originates from an SRD compendium.
 * Matches by identifier against the SRD registry (covers PHB-sourced items
 * that exist in the SRD), with fallback to source.book for items without identifiers.
 */
function isSrdItem(item: Record<string, any>): boolean {
    const identifier: string = item.system?.identifier ?? '';
    if (isSrdIdentifier(identifier)) return true;

    // Fallback for items that may lack an identifier but have an SRD source book
    const book: string = item.system?.source?.book ?? '';
    return book.startsWith('SRD');
}

/**
 * Create a slim SRD item with only character-specific state.
 * The website resolves full reference data via the identifier.
 */
function slimSrdItem(item: Record<string, any>): Record<string, any> {
    const sys = item.system ?? {};
    const type = item.type as string;

    // Base fields shared across all item types
    const slim: Record<string, any> = {
        _id: item._id,
        name: item.name,
        type: item.type,
        img: item.img,
        system: {
            identifier: sys.identifier,
        },
    };

    // Physical items: inventory state
    if ((PHYSICAL_ITEM_TYPES as readonly string[]).includes(type)) {
        slim.system.quantity = sys.quantity;
        slim.system.equipped = sys.equipped;
        slim.system.attuned = sys.attuned;
        slim.system.container = sys.container;
        if (sys.uses) {
            slim.system.uses = { ...sys.uses };
        }
    }

    // Features: type classification + uses
    if (type === 'feat') {
        if (sys.type) slim.system.type = sys.type;
        if (sys.uses) {
            slim.system.uses = { ...sys.uses };
        }
    }

    // Classes: character progression state
    if (type === 'class') {
        slim.system.levels = sys.levels;
        if (sys.hd) slim.system.hd = { ...sys.hd };
        if (sys.spellcasting) slim.system.spellcasting = { ...sys.spellcasting };
    }

    // Subclasses: link to parent class
    if (type === 'subclass') {
        slim.system.classIdentifier = sys.classIdentifier;
        if (sys.spellcasting) slim.system.spellcasting = { ...sys.spellcasting };
    }

    // Background and race: identifier is sufficient (no character-specific state)

    return slim;
}

/**
 * Transform all actor items, stripping SRD reference data.
 * Spells are excluded — they're handled separately by spell-transform.ts.
 *
 * @param resolvedItems Items from actor.items.contents.map(i => i.toObject(false))
 * @returns Transformed items array with SRD items slimmed down
 */
export function transformActorItems(resolvedItems: Record<string, any>[]): Record<string, any>[] {
    return resolvedItems.map(item => {
        // Spells are handled by spell-transform.ts
        if (item.type === 'spell') return item;

        if (!isSrdItem(item)) return item;

        return slimSrdItem(item);
    });
}
