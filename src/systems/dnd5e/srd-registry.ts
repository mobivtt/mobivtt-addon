/**
 * SRD identifier registry for D&D 5e.
 *
 * Builds a Set of all identifiers from the system's SRD compendium packs at init time.
 * Used by item-transform and spell-transform to detect SRD content by identifier
 * instead of relying on source.book (which is unreliable — PHB-sourced items
 * that exist in the SRD won't have source.book starting with "SRD").
 */

/** Compendium packs that contain SRD reference content. */
const SRD_PACKS = [
    'dnd5e.classes',
    'dnd5e.classes24',
    'dnd5e.classfeatures',
    'dnd5e.subclasses',
    'dnd5e.spells',
    'dnd5e.spells24',
    'dnd5e.items',
    'dnd5e.equipment24',
    'dnd5e.backgrounds',
    'dnd5e.origins24',
    'dnd5e.races',
    'dnd5e.feats24',
    'dnd5e.tradegoods',
] as const;

/** All known SRD identifiers, populated once during init. */
let srdIdentifiers: Set<string> | null = null;

/**
 * Build the SRD identifier set from compendium pack indexes.
 * Call once during adapter initialization (after packs are available).
 */
export async function buildSrdRegistry(): Promise<void> {
    const ids = new Set<string>();

    for (const packId of SRD_PACKS) {
        const pack = game.packs.get(packId);
        if (!pack) continue;

        const index = await pack.getIndex({ fields: ['system.identifier'] });
        for (const entry of index) {
            const identifier = (entry as any).system?.identifier;
            if (identifier) ids.add(identifier);
        }
    }

    srdIdentifiers = ids;
    console.log(`[MobiVTT] SRD registry built: ${ids.size} identifiers from ${SRD_PACKS.length} packs`);
}

/**
 * Check if an identifier exists in the SRD registry.
 * Falls back to false if the registry hasn't been built yet.
 */
export function isSrdIdentifier(identifier: string | undefined): boolean {
    if (!identifier || !srdIdentifiers) return false;
    return srdIdentifiers.has(identifier);
}
