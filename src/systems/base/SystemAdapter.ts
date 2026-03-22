/**
 * Base interface for game system adapters.
 * Each supported game system must implement this interface.
 */
export interface SystemAdapter {
    /**
     * The system ID as defined in Foundry (e.g., 'dnd5e', 'pf2e')
     */
    readonly systemId: string;

    /**
     * Initialize the system adapter and inject UI controls
     */
    initialize(): void;

    /**
     * Serialize an actor to JSON format for syncing
     * @param actor The actor to serialize
     */
    serializeActor(actor: Actor): ActorData | null;

    /**
     * Check if an actor should be synced
     * @param actor The actor to check
     */
    shouldSync(actor: Actor): boolean;

    /**
     * Get the supported version range for this adapter
     */
    getSupportedVersions(): VersionRange;
}

export interface ActorData {
    name: string;
    system: Record<string, any>;
    items: any[];
    spellDetails?: Record<string, any>;
}

export interface VersionRange {
    minimum: string;
    maximum?: string;
}
