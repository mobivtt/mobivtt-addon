import {sendActor} from "./sync";
import {metricsCollector} from "./metrics";

type Validator = (v: unknown) => boolean;

const isNumber: Validator = (v) => typeof v === 'number' && Number.isFinite(v);
const isBoolean: Validator = (v) => typeof v === 'boolean';

const ALLOWED_EDIT_PATHS: Record<string, { type: 'absolute'; validate: Validator }> = {
    'system.attributes.hp.value': { type: 'absolute', validate: isNumber },
    'system.attributes.hp.temp': { type: 'absolute', validate: isNumber },
    'system.attributes.inspiration': { type: 'absolute', validate: isBoolean },
    'system.attributes.death.success': { type: 'absolute', validate: isNumber },
    'system.attributes.death.failure': { type: 'absolute', validate: isNumber },
    'system.spells.spell1.value': { type: 'absolute', validate: isNumber },
    'system.spells.spell2.value': { type: 'absolute', validate: isNumber },
    'system.spells.spell3.value': { type: 'absolute', validate: isNumber },
    'system.spells.spell4.value': { type: 'absolute', validate: isNumber },
    'system.spells.spell5.value': { type: 'absolute', validate: isNumber },
    'system.spells.spell6.value': { type: 'absolute', validate: isNumber },
    'system.spells.spell7.value': { type: 'absolute', validate: isNumber },
    'system.spells.spell8.value': { type: 'absolute', validate: isNumber },
    'system.spells.spell9.value': { type: 'absolute', validate: isNumber },
    'system.spells.pact.value': { type: 'absolute', validate: isNumber },
    'system.currency.pp': { type: 'absolute', validate: isNumber },
    'system.currency.gp': { type: 'absolute', validate: isNumber },
    'system.currency.ep': { type: 'absolute', validate: isNumber },
    'system.currency.sp': { type: 'absolute', validate: isNumber },
    'system.currency.cp': { type: 'absolute', validate: isNumber },
    'system.resources.primary.value': { type: 'absolute', validate: isNumber },
    'system.resources.secondary.value': { type: 'absolute', validate: isNumber },
    'system.resources.tertiary.value': { type: 'absolute', validate: isNumber },
};

const ALLOWED_ITEM_PATHS = new Set([
    'system.preparation.prepared',  // dnd5e 4.x: boolean prepared flag
    'system.prepared',              // dnd5e 5.x: numeric prepared (0 or 1)
    'system.hd.spent',
    'system.uses.spent',
]);
const ALLOWED_ACTIONS = new Set(['action.shortRest', 'action.longRest', 'action.toggleCondition', 'action.setConditions', 'action.setExhaustion']);

interface EditUpdate {
    id: string;
    character_id: string;
    type: 'absolute';
    path: string;
    value?: unknown;
}

class EditApplicator {
    async applyEdits(
        characterId: string,
        updates: { id: string; path: string; type: 'absolute'; value?: unknown }[]
    ): Promise<{ id: string; status: 'applied' | 'failed'; error?: string }[]> {
        const results: { id: string; status: 'applied' | 'failed'; error?: string }[] = [];
        for (const update of updates) {
            const edit: EditUpdate = {
                id: update.id,
                character_id: characterId,
                type: update.type,
                path: update.path,
                value: update.value,
            };
            const result = await this.applyUpdate(edit);
            if (!result.success) {
                metricsCollector.track(
                    'edit_request_rejected',
                    'health',
                    'addon',
                    {
                        foundry_major: game.version?.split('.')[0],
                        system: game.world.system,
                        metadata: { reason: result.error || 'unknown' },
                    }
                );
            }
            results.push({ id: update.id, status: result.success ? 'applied' : 'failed', error: result.error });
        }
        return results;
    }

    private async applyUpdate(update: EditUpdate): Promise<{ success: boolean; error?: string }> {
        try {
            const actor = game.actors?.get(update.character_id);
            if (!actor) return { success: false, error: 'Actor not found' };
            if (!actor.isOwner) return { success: false, error: 'No permission' };

            if (ALLOWED_ACTIONS.has(update.path)) {
                // @ts-ignore - D&D 5e specific methods
                if (update.path === 'action.shortRest') await actor.shortRest();
                // @ts-ignore
                else if (update.path === 'action.longRest') await actor.longRest();
                else if (update.path === 'action.toggleCondition' && typeof update.value === 'string') {
                    // @ts-ignore - FoundryVTT v12+ API
                    await actor.toggleStatusEffect(update.value);
                }
                else if (update.path === 'action.setConditions' && Array.isArray(update.value)) {
                    const desired = new Set(update.value as string[]);
                    const current = new Set(
                        Array.from((actor as any).effects ?? [])
                            .filter((e: any) => !e.disabled && e.statuses?.size > 0)
                            .flatMap((e: any) => [...e.statuses])
                            .filter((id: string) => id !== 'exhaustion' && id !== 'dead')
                    );
                    for (const id of current) {
                        // @ts-ignore
                        if (!desired.has(id)) await actor.toggleStatusEffect(id);
                    }
                    for (const id of desired) {
                        // @ts-ignore
                        if (!current.has(id)) await actor.toggleStatusEffect(id);
                    }
                }
                else if (update.path === 'action.setExhaustion' && isNumber(update.value)) {
                    const level = update.value as number;
                    if (level < 0 || level > 6) return { success: false, error: 'Exhaustion level must be 0-6' };
                    // @ts-ignore - D&D 5e specific
                    await actor.update({ 'system.attributes.exhaustion': level });
                }
                else return { success: false, error: `Unknown action: ${update.path}` };
                sendActor(actor);
                console.log(`[MobiVTT] Applied ${update.path} to ${actor.name}`);
                return { success: true };
            }

            if (update.path.startsWith('items.')) return this.applyItemUpdate(actor, update);

            const rule = ALLOWED_EDIT_PATHS[update.path];
            if (!rule) return { success: false, error: `Path not allowed: ${update.path}` };

            const newValue = update.value;

            if (!rule.validate(newValue)) return { success: false, error: `Invalid value for ${update.path}` };

            await actor.update({ [update.path]: newValue });
            console.log(`[MobiVTT] Applied edit to ${actor.name}: ${update.path} = ${newValue}`);
            return { success: true };
        } catch (error) {
            console.error('[MobiVTT] Failed to apply update:', error);
            return { success: false, error: String(error) };
        }
    }

    private async applyItemUpdate(actor: Actor, update: EditUpdate): Promise<{ success: boolean; error?: string }> {
        const parts = update.path.split('.');
        if (parts.length < 3) return { success: false, error: 'Invalid item path' };
        const itemId = parts[1];
        const itemPath = parts.slice(2).join('.');
        if (!ALLOWED_ITEM_PATHS.has(itemPath)) return { success: false, error: `Item path not allowed: ${itemPath}` };
        const item = actor.items.get(itemId);
        if (!item) return { success: false, error: `Item ${itemId} not found` };
        await item.update({ [itemPath]: update.value });
        sendActor(actor);
        console.log(`[MobiVTT] Applied item edit on ${actor.name}: ${update.path} = ${update.value}`);
        return { success: true };
    }
}

export const editApplicator = new EditApplicator();
