import {SystemAdapter, ActorData, VersionRange} from '../base/SystemAdapter';
import {sheetInject as sheetInject44} from './versions/4.4.x';
import {sheetInject as sheetInject50} from './versions/5.0.x';
import {DnD5eExporter} from './exporter';

/**
 * Adapter for D&D 5e system
 */
export class DnD5eAdapter implements SystemAdapter {
    readonly systemId = 'dnd5e';
    private exporter: DnD5eExporter | null = null;

    initialize(): void {
        const systemVersion = game.world.systemVersion;

        // Determine which version-specific sheet injection to use
        const sysMajor = parseInt(systemVersion.split('.')[0], 10);
        if (sysMajor >= 5) {
            sheetInject50();
        } else {
            sheetInject44();
        }

        this.exporter = new DnD5eExporter(systemVersion);

        console.log(`[MobiVTT] DnD5e adapter initialized for version ${systemVersion}`);
    }

    async serializeActor(actor: Actor): Promise<ActorData | null> {
        if (!this.exporter) return null;
        return this.exporter.export(actor);
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
