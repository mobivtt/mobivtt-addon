import {copyUrlAction} from "../../settings";


export const sheetInject = () => {
    Hooks.on("getActorSheet5eHeaderButtons", function (actorSheet: ActorSheet5eCharacter, buttons) {

        if (actorSheet.object.getFlag("mobivtt", "sync")) {
            buttons.unshift({
                label: "Copy Character Sheet Mobile Page",
                class: "mobivtt-copy-sheet-url",
                icon: "fas fa-mobile",
                onclick: () => {
                    copyUrlAction(actorSheet.object)

                }
            })
            buttons.unshift({
                label: "Disable MobiVTT for this character",
                class: "mobivtt-enable-sync",
                icon: "fas fa-eye-slash",
                onclick: () => {
                    actorSheet.object.update({['flags.mobivtt.sync']: false})
                    ui.notifications?.info(`Character will not be updated to MobiVTT.`);
                }
            })

        } else {
            buttons.unshift({
                label: "Enable MobiVTT for this character",
                class: "mobivtt-disable-sync",
                icon: "fas fa-mobile",
                onclick: () => {
                    ui.notifications?.info(`Character will be synced to MobiVTT.`);
                    actorSheet.object.update({['flags.mobivtt.sync']: true})
                    copyUrlAction(actorSheet.object)
                }
            })
        }
    })
}
