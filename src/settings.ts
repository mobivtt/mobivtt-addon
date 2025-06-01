export const generateCharSheetUrl = (characterID: string) => {
    const h = btoa(`${game.settings.get('mobivtt', 'license_key')}|${game.world.id}|${characterID}`)
    return getUrl(`play/${h}`);

}
export const copyUrlAction = (actor) => {
    const url = generateCharSheetUrl(actor.id as string);
    game.clipboard.copyPlainText(url);
    ui.notifications?.info(`Copied ${url} to clipboard`);
}

export const getUrl = (path: string) => {
    return `${__MOBIVTT_WEB__}/${path}`;
}

export const hasLicense = () => {

    const license = game.settings.get('mobivtt', 'license_key');
    return license.trim() !== '';
}

export const validateLicense = async (): Promise<boolean> => {
    if(!hasLicense()){
        return false;
    }
    const res = await fetch(getUrl('api/subscribe/validate'), {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            access_code: game.settings.get('mobivtt', 'license_key')
        })
    });
    if (res.ok) {
        const {success = false} = await res.json()
        return success
    }
    return false;
}
export const initSettings = () => {
    /*
     * Create a custom config setting
     */
    game.settings.register('mobivtt', 'license_key', {
        name: 'Access Code',
        hint: 'Access Code required for MobiVTT to work.',
        scope: 'world',     // "world" = sync to db, "client" = local storage
        config: true,       // false if you dont want it to show in module config
        type: String,       // You want the primitive class, e.g. Number, not the name of the class as a string
        default: '',
        // onChange: value => { // value is the new value of the setting
        //     console.log('NEW LICENSE', value)
        // },
        requiresReload: true
    });
    game.settings.register('mobivtt', 'game_type', {
        name: 'Game type',
        hint: 'Supported games. Others coming soon.',
        scope: 'world',     // "world" = sync to db, "client" = local storage
        config: true,       // false if you dont want it to show in module config
        type: String,       // You want the primitive class, e.g. Number, not the name of the class as a string
        default: 'GAME_DND5E',
        choices: {
            GAME_DND5E: 'Dungeons & Dragons Fifth Edition'
        }
    });

}
