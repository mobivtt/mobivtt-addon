import {initSettings, validateLicense, type PlanInfo} from './settings'
import {startSync} from './sync'
import {editApplicator} from './mobile-sync'
import {rollApplicator} from './mobile-roll'
import {mobiWs} from './websocket'
import {SystemRegistry} from './systems/registry'
import {DnD5eAdapter} from './systems/dnd5e/DnD5eAdapter'
import {buildSrdRegistry} from './systems/dnd5e/srd-registry'
import {FoundryVersionManager} from './foundry/FoundryVersionManager'
import {extractPortrait} from './systems/dnd5e/mappers/portrait'
import {metricsCollector} from './metrics'

Hooks.on("init", function () {
    if (import.meta.env.DEV) CONFIG.debug.hooks = true;
    initSettings();

    // Register supported game systems
    SystemRegistry.register(new DnD5eAdapter());
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
    const currentSystem = game.world.system;

    if (!SystemRegistry.isSupported(currentSystem)) {
        ui.notifications?.warn(
            `MobiVTT does not support the "${currentSystem}" system yet. ` +
            `Supported systems: ${SystemRegistry.getSupportedSystems().join(', ')}`
        );
        console.warn(`[MobiVTT] Unsupported system: ${currentSystem}`);
        return;
    }

    const adapter = SystemRegistry.getAdapter(currentSystem);
    if (!adapter) {
        console.error(`[MobiVTT] Failed to get adapter for system: ${currentSystem}`);
        return;
    }

    adapter.initialize();

    if (currentSystem === 'dnd5e') {
        await buildSrdRegistry();
    }

    FoundryVersionManager.configure(game.version);

    startSync(adapter);

    metricsCollector.track(
        'addon_initialized',
        'infrastructure',
        'addon',
        {
            system: currentSystem,
            foundry_major: game.version?.split('.')[0],
        }
    );

    (globalThis as any).mobivtt = {
        plan: null as PlanInfo | null,
        exportCharacter: async (actorNameOrIndex?: string | number) => {
            let actor: Actor | undefined;
            if (typeof actorNameOrIndex === 'number') {
                actor = game.actors?.contents[actorNameOrIndex];
            } else if (typeof actorNameOrIndex === 'string') {
                actor = game.actors?.getName(actorNameOrIndex) ?? undefined;
            } else {
                actor = game.actors?.contents[0];
            }
            if (!actor) { console.error('[MobiVTT] Actor not found'); return null; }
            const payload = await adapter.serializeActor(actor);
            if (!payload) { console.error('[MobiVTT] Failed to serialize actor'); return null; }
            const portrait = await extractPortrait(actor);
            const json = JSON.stringify({ ...payload, portrait }, null, 2);
            navigator.clipboard.writeText(json).then(
                () => console.log(`[MobiVTT] Exported "${actor!.name}" to clipboard (${json.length} bytes)`),
                () => console.log(`[MobiVTT] Clipboard failed. JSON logged below:\n${json}`)
            );
            return payload;
        },
    };

    const accessCode = (game.settings.get('mobivtt', 'license_key') as string).trim();
    if (!accessCode) return;

    const plan = await validateLicense();
    if (!plan) {
        ui.notifications?.error(
            'MobiVTT: Invalid or expired access code. Check your license key in Module Settings.',
            { permanent: true }
        );
        return;
    }
    (globalThis as any).mobivtt.plan = plan;

    const setting = (game.settings as any).settings.get('mobivtt.license_key');
    if (setting) setting.hint = `Current subscription: ${plan.plan_type}`;

    mobiWs.connect(accessCode, game.world.id);

    mobiWs.onEditRequest(async (msg) => {
            const results = await editApplicator.applyEdits(msg.characterId, msg.updates);
            const allApplied = results.every(r => r.status === 'applied');
            mobiWs.sendEditAck(
                msg.updates.map(u => u.id),
                allApplied ? 'applied' : 'failed'
            );
        });

    mobiWs.onRollRequest(async (msg) => {
            await rollApplicator.postRoll(msg.characterId, msg.roll);
        });
});
