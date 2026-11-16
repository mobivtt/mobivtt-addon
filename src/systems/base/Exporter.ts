export interface Exporter<T> {
    export(actor: Actor): Promise<T | null>;
}

export interface VersionHandler<TSystem, TContent, TSpellDetails> {
    mapSystem(actor: Actor, skillTranslations?: Map<string, { label: string; description: string }>, conditionTranslations?: Map<string, { label: string; description: string }>): TSystem;
    mapContent(resolvedItems: Record<string, any>[], actor: Actor): TContent;
    mapSpellDetails(actor: Actor, translations?: Map<string, { name: string; description: string }>): TSpellDetails;
}
