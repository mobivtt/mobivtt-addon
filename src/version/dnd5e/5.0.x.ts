import {copyUrlAction} from "../../settings";

export const sheetInject = ()=>{
    Hooks.on("getHeaderControlsPrimarySheet5e", function (actorSheet: CharacterActorSheet, buttons) {
        actorSheet.options.actions['mobivttCopySheetUrl'] = () => {
            copyUrlAction(actorSheet.actor)
        }
        actorSheet.options.actions['mobivttEnableSync'] = () => {
            ui.notifications?.info(`Character will be synced to MobiVTT.`);
            actorSheet.actor.update({['flags.mobivtt.sync']: true})
            copyUrlAction(actorSheet.actor)
        }
        actorSheet.options.actions['mobivttDisableSync'] = () => {
            actorSheet.actor.update({['flags.mobivtt.sync']: false})
            ui.notifications?.info(`Character will not be updated to MobiVTT.`);
        }


        if (actorSheet.actor.getFlag("mobivtt", "sync")) {
            buttons.unshift({
                icon: "fa-solid fa-mobile",
                label: "Copy Character Sheet Mobile Page",
                action: "mobivttCopySheetUrl",
                visible: true
            })
            buttons.unshift({
                icon: "fa-solid fa-eye-slash",
                label: "Disable MobiVTT for this character",
                action: "mobivttDisableSync",
                visible: true
            })
        }else{
            buttons.unshift({
                icon: "fa-solid fa-mobile",
                label: "Enable MobiVTT for this character",
                action: "mobivttEnableSync",
                visible: true
            })
        }






    })
}
