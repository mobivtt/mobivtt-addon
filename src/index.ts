import {initSettings} from './settings'
import {startSync} from './sync'
import {sheetInject as dnd5eHooks50} from './version/dnd5e/5.0.x'
import {sheetInject as dnd5eHooks44} from './version/dnd5e/4.4.x'
import {config as foundryVTT12} from './version/foundry/12.x'
import {config as foundryVTT13} from './version/foundry/13.x'

Hooks.on("init", function () {
    CONFIG.debug.hooks = true
    initSettings();
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function () {

    if (game.world.system == 'dnd5e') {

        if (foundry.utils.isNewerVersion(game.world.systemVersion, "5.0.0")) {
            dnd5eHooks50();
        } else {
            dnd5eHooks44();
        }


        if (foundry.utils.isNewerVersion(game.version, "13.0")) {
            foundryVTT13();
        }else{
            foundryVTT12();
        }
    }
    startSync();
});
