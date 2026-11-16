import {SystemAdapter} from "./systems/base/SystemAdapter";
import {mobiWs} from "./websocket";
import {extractPortrait, resolvePortraitPath} from "./systems/dnd5e/mappers/portrait";

let systemAdapter: SystemAdapter | null = null;

// Debounce per-actor to coalesce rapid hook bursts (e.g. level-up fires
// updateActor + createItem + updateItem + deleteItem via Promise.all)
const pendingSync = new Map<string, ReturnType<typeof setTimeout>>();

const scheduleSendActor = (actor: Actor, action = 'update') => {
    const id = actor.id!;
    clearTimeout(pendingSync.get(id));
    pendingSync.set(id, setTimeout(() => {
        pendingSync.delete(id);
        sendActor(actor, action);
    }, 1000));
};

export const sendActor = async (actor: Actor, action = 'update') => {
    if (!systemAdapter) {
        console.error('[MobiVTT] No system adapter available');
        return;
    }

    if (!systemAdapter.shouldSync(actor)) {
        console.log(`[MobiVTT] Skipping ${actor.name}. Reason: Not enabled`);
        action = 'delete';
    }

    const actorObject = action === 'delete' ? false : await systemAdapter.serializeActor(actor);

    if (actorObject === null && action !== 'delete') {
        return;
    }

    if (!mobiWs.connected) {
        return;
    }

    if (action === 'delete' || actorObject === false) {
        mobiWs.sendCharacterDelete(actor.id!);
    } else if (actorObject) {
        await mobiWs.sendCharacterUpdate(actor.id!, actorObject);
        const portraitSource = resolvePortraitPath(actor);
        if (mobiWs.needsPortraitUpdate(actor.id!, portraitSource)) {
            const portrait = await extractPortrait(actor);
            if (mobiWs.connected) {
                mobiWs.sendPortraitUpdate(actor.id!, portrait, portraitSource);
            }
        }
    }
};

const syncAllChars = () => {
    game.actors?.contents.forEach(sendActor);
};

export const startSync = (adapter: SystemAdapter) => {
    systemAdapter = adapter;

    Hooks.on('updateActor', (actor: Actor, _changes: unknown, status: { diff: boolean }) => {
        if (!status.diff) return;
        scheduleSendActor(actor);
    });

    Hooks.on('deleteActor', (actor: Actor) => {
        sendActor(actor, 'delete');
    });

    for (const hook of ['createItem', 'updateItem', 'deleteItem'] as const) {
        Hooks.on(hook, (item: any) => {
            const actor = item.parent;
            if (actor instanceof Actor) scheduleSendActor(actor);
        });
    }

    for (const hook of ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect'] as const) {
        Hooks.on(hook, (effect: any) => {
            const actor = effect.parent;
            if (actor instanceof Actor) scheduleSendActor(actor);
        });
    }

    mobiWs.onConnect(() => {
        syncAllChars();
    });
};
