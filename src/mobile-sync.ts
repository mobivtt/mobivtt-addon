import {getUrl} from "./settings";
import {sendActor} from "./sync";

interface PendingUpdate {
    id: string;
    character_id: string;
    type: 'delta' | 'absolute';
    path: string;
    value: unknown;
    delta?: number;
    created_at: string;
}

interface ApplyResult {
    success: boolean;
    error?: string;
}

class MobileSyncManager {
    private pollInterval: number = 10000;
    private intervalId: number | null = null;

    start(): void {
        if (this.intervalId) return;

        this.fetchAndApplyUpdates();

        this.intervalId = window.setInterval(() => {
            this.fetchAndApplyUpdates();
        }, this.pollInterval);

        console.log('[MobiVTT] Mobile sync started');
    }

    stop(): void {
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[MobiVTT] Mobile sync stopped');
        }
    }

    async fetchAndApplyUpdates(): Promise<void> {
        const accessCode = game.settings.get('mobivtt', 'license_key') as string;
        const worldId = game.world.id;

        if (!accessCode) return;

        try {
            const response = await fetch(
                `${getUrl('api/foundryvtt/pending-updates')}?access_code=${encodeURIComponent(accessCode)}&world_id=${encodeURIComponent(worldId)}`
            );
            const data = await response.json();

            if (!data.success || !data.updates || data.updates.length === 0) return;

            console.log(`[MobiVTT] Received ${data.updates.length} pending updates from mobile`);

            const results: { id: string; status: 'applied' | 'failed'; error?: string }[] = [];

            for (const update of data.updates as PendingUpdate[]) {
                const result = await this.applyUpdate(update);
                results.push({
                    id: update.id,
                    status: result.success ? 'applied' : 'failed',
                    error: result.error
                });
            }

            await fetch(getUrl('api/foundryvtt/ack-updates'), {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    access_code: accessCode,
                    update_ids: results.map(r => r.id),
                    results
                })
            });

        } catch (error) {
            console.error('[MobiVTT] Failed to fetch mobile updates:', error);
        }
    }

    private async applyUpdate(update: PendingUpdate): Promise<ApplyResult> {
        try {
            const actor = game.actors?.get(update.character_id);
            if (!actor) {
                return {success: false, error: 'Actor not found'};
            }

            if (!actor.isOwner) {
                return {success: false, error: 'No permission'};
            }

            // Handle item-level updates (e.g., items.{_id}.system.preparation.prepared)
            if (update.path.startsWith('items.')) {
                const parts = update.path.split('.');
                const itemId = parts[1];
                const itemPath = parts.slice(2).join('.');

                const item = actor.items.get(itemId);
                if (!item) {
                    return {success: false, error: `Item ${itemId} not found on actor ${actor.id}`};
                }

                await item.update({[itemPath]: update.value});

                // Force actor re-sync so mobile client sees updated state
                // (item.update() may fire updateItem hook instead of updateActor)
                sendActor(actor);

                console.log(`[MobiVTT] Applied item update to ${actor.name}: ${update.path} = ${update.value}`);
                return {success: true};
            }

            if (update.path === 'action.shortRest') {
                // @ts-ignore - D&D 5e specific method
                await actor.shortRest();
                console.log(`[MobiVTT] Applied short rest to ${actor.name}`);
                return {success: true};
            }

            if (update.path === 'action.longRest') {
                // @ts-ignore - D&D 5e specific method
                await actor.longRest();
                console.log(`[MobiVTT] Applied long rest to ${actor.name}`);
                return {success: true};
            }

            let newValue: unknown;

            if (update.type === 'delta' && update.delta !== undefined) {
                const currentValue = foundry.utils.getProperty(actor, update.path) as number;
                newValue = (currentValue || 0) + update.delta;
            } else {
                newValue = update.value;
            }

            await actor.update({[update.path]: newValue});

            console.log(`[MobiVTT] Applied mobile update to ${actor.name}: ${update.path} = ${newValue}`);
            return {success: true};

        } catch (error) {
            console.error('[MobiVTT] Failed to apply update:', error);
            return {success: false, error: String(error)};
        }
    }
}

export const mobileSyncManager = new MobileSyncManager();
