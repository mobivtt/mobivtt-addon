import {SystemAdapter, ActorData, VersionRange} from '../base/SystemAdapter';
import {sheetInject as sheetInject44} from './versions/4.4.x';
import {sheetInject as sheetInject50} from './versions/5.0.x';
import {transformActorSpells} from './spell-transform';
import {transformActorItems} from './item-transform';

/**
 * Adapter for D&D 5e system
 */
export class DnD5eAdapter implements SystemAdapter {
    readonly systemId = 'dnd5e';

    initialize(): void {
        const systemVersion = game.world.systemVersion;

        // Determine which version-specific sheet injection to use
        if (foundry.utils.isNewerVersion(systemVersion, "5.0.0")) {
            sheetInject50();
        } else {
            sheetInject44();
        }

        console.log(`[MobiVTT] DnD5e adapter initialized for version ${systemVersion}`);
    }

    serializeActor(actor: Actor): ActorData | null {
        // Only sync character actors
        // @ts-ignore
        if (actor.type !== 'character') {
            console.log(`[MobiVTT] Skipping ${actor.name}. Reason: Not a character`);
            return null;
        }

        // Use toObject(false) for items to resolve formula strings
        // (e.g. uses.max: "max(1, @abilities.cha.mod)" → 1)
        // @ts-ignore - items property exists on Actor5e
        const resolvedItems = actor.items.contents.map((i: any) => i.toObject(false));

        // Copy prepared/derived system data from actor.system which includes
        // computed fields (mod, dc, save.value, total, etc.) and derived-only
        // properties (scale, attributes.hd, attributes.prof, details.level, etc.)
        // that toObject(false) omits since they're not part of the schema.
        const system: Record<string, any> = {};
        // @ts-ignore - system property exists on Actor5e
        Object.keys(actor.system).forEach(key => {
            // @ts-ignore
            system[key] = actor.system[key];
        });


        // Extract spell details from live actor items (activities need live Document access)
        const spellDetails = transformActorSpells(actor);

        return {
            name: actor.name || '',
            system,
            items: transformActorItems(resolvedItems),
            ...(Object.keys(spellDetails).length > 0 ? { spellDetails } : {}),
        };
    }

    shouldSync(actor: Actor): boolean {
        return actor.getFlag("mobivtt", "sync") === true;
    }

    getSupportedVersions(): VersionRange {
        return {
            minimum: "4.4.0",
            maximum: undefined
        };
    }
}
