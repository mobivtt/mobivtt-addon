import {CronJob} from "cron";
import {getUrl} from "./settings";
import {SystemAdapter} from "./systems/base/SystemAdapter";

class ThrottledErrorNotifier {
    private lastShown = 0;
    private cooldown: number;

    constructor(cooldownMs = 5000) {
        this.cooldown = cooldownMs;
    }

    show(message: string) {
        const now = Date.now();
        if (now - this.lastShown >= this.cooldown) {
            ui.notifications?.error(message);
            this.lastShown = now;
        }
    }
}

const notifier = new ThrottledErrorNotifier(7000); // one message per 10sec

let systemAdapter: SystemAdapter | null = null;

export const sendActor = (actor: Actor, action = 'update') => {
    if (!systemAdapter) {
        console.error('[MobiVTT] No system adapter available');
        return;
    }

    // Check if actor should be synced
    if (!systemAdapter.shouldSync(actor)) {
        console.log(`[MobiVTT] Skipping ${actor.name}. Reason: Not enabled`);
        action = 'delete';
    }

    // Serialize actor data
    const actorObject = action === 'delete' ? false : systemAdapter.serializeActor(actor);

    // Skip if serialization returns null (e.g., wrong actor type)
    if (actorObject === null && action !== 'delete') {
        return;
    }

    fetch(getUrl('api/foundryvtt/update'), {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            access_code: game.settings.get('mobivtt', 'license_key'),
            world_id: game.world.id,
            character_id: actor.id,
            state: actorObject
        })
    })
        .then(res => res.json())
        .then(jsonData => {
            if (!jsonData.success) {
                notifier.show(jsonData.message);
            }
        })
}

const syncAllChars = () => {
    // @ts-ignore
    game.actors?.contents.forEach(sendActor);
}

export const startSync = (adapter: SystemAdapter) => {
    systemAdapter = adapter;

    Hooks.on('updateActor', (actor: Actor, changes, status) => {
        if (!status.diff) {
            return;
        }
        sendActor(actor);
    });

    Hooks.on('deleteActor', (actor: Actor, changes, status) => {
        sendActor(actor, 'delete');
    });

    syncAllChars();

    new CronJob('*/50 * * * * *', () => {
            syncAllChars();
        },
        null,
        true
    );
}
