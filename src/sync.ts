import {CronJob} from "cron";
import {getUrl} from "./settings";

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


const actorToJSON = (actor: Actor5e) => {
    const system = {}

    Object.keys(actor.system).map(key => {
        // @ts-ignore
        system[key] = actor.system[key]
    })

    return {name: actor.name, system, items: actor.items};
}

const sendActor = (character: Actor5e, action = 'update') => {
    // @ts-ignore
    if (character.type !== 'character'){
        console.log('[MobiVTT] Skipping ' + character.name+'. Reason: Not a character');
        return;
    }
    if (!character.getFlag("mobivtt", "sync")) {
        console.log('[MobiVTT] Skipping ' + character.name+'. Reason: Not enabled');
        action = 'delete'
    }

    const actorObject = action === 'delete' ? false : actorToJSON(character);
    fetch(getUrl('api/foundryvtt/update'), {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            access_code: game.settings.get('mobivtt', 'license_key'),
            world_id: game.world.id,
            character_id: character.id,
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
    game.actors?.contents.map(sendActor)
}
export const startSync = () => {
    Hooks.on('updateActor', (actor: Actor5e, changes, status) => {
        if (!status.diff) {
            return;
        }
        sendActor(actor)
    });
    Hooks.on('deleteActor', (actor: Actor5e, changes, status) => {
        sendActor(actor, 'delete')
    });

    syncAllChars()
    new CronJob('*/50 * * * * *', () => {
            syncAllChars()
        },
        null,
        true
    )
}
