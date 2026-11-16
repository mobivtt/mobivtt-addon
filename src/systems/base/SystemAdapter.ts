import type { Dnd5eCharacter } from '../../types/character';

export interface SystemAdapter {
    readonly systemId: string;
    initialize(): void;
    serializeActor(actor: Actor): Promise<Dnd5eCharacter | null>;
    shouldSync(actor: Actor): boolean;
    getSupportedVersions(): VersionRange;
}

export type ActorData = Dnd5eCharacter;

export interface VersionRange {
    minimum: string;
    maximum?: string;
}
