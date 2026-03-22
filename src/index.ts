import {initSettings} from './settings'
import {startSync} from './sync'
import {mobileSyncManager} from './mobile-sync'
import {SystemRegistry} from './systems/registry'
import {DnD5eAdapter} from './systems/dnd5e/DnD5eAdapter'
import {buildSrdRegistry} from './systems/dnd5e/srd-registry'
import {FoundryVersionManager} from './foundry/FoundryVersionManager'

Hooks.on("init", function () {
    CONFIG.debug.hooks = true
    initSettings();

    // Register supported game systems
    SystemRegistry.register(new DnD5eAdapter());
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
    const currentSystem = game.world.system;

    // Check if current system is supported
    if (!SystemRegistry.isSupported(currentSystem)) {
        ui.notifications?.warn(
            `MobiVTT does not support the "${currentSystem}" system yet. ` +
            `Supported systems: ${SystemRegistry.getSupportedSystems().join(', ')}`
        );
        console.warn(`[MobiVTT] Unsupported system: ${currentSystem}`);
        return;
    }

    // Get the adapter for the current system
    const adapter = SystemRegistry.getAdapter(currentSystem);
    if (!adapter) {
        console.error(`[MobiVTT] Failed to get adapter for system: ${currentSystem}`);
        return;
    }

    // Initialize the system adapter
    adapter.initialize();

    // Build SRD identifier registry before sync starts (identifier-based SRD detection)
    if (currentSystem === 'dnd5e') {
        await buildSrdRegistry();
    }

    // Configure Foundry version-specific features
    FoundryVersionManager.configure(game.version);

    startSync(adapter);
    mobileSyncManager.start();
});
