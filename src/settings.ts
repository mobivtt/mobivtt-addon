import {metricsCollector} from './metrics';

export const generateCharSheetUrl = (characterID: string) => {
    const h = btoa(`${game.settings.get('mobivtt', 'license_key')}|${game.world.id}|${characterID}`)
    return getUrl(`play/${h}`);

}
export const copyUrlAction = (actor) => {
    const url = generateCharSheetUrl(actor.id as string);
    game.clipboard.copyPlainText(url);
    ui.notifications?.info(`Copied ${url} to clipboard`);
}

/**
 * Shared by every sheet version. Returns true when the character must NOT be
 * synced. The server also enforces the limit, but it only ever sees characters
 * this check let through, so this is the sole place the user's intent to exceed
 * their plan is observable.
 */
export const isBlockedByCharacterLimit = (): boolean => {
    const plan = (globalThis as any).mobivtt?.plan;
    if (!plan) return false;

    const synced = game.actors?.contents.filter((a: any) => a.getFlag('mobivtt', 'sync')).length ?? 0;
    if (synced < plan.character_limit) return false;

    ui.notifications?.warn(
        `Character limit reached (${synced}/${plan.character_limit}). Upgrade your plan at mobivtt.com to sync more characters.`,
    );
    metricsCollector.track('character_limit_blocked', 'business', 'addon', {
        access_code: game.settings.get('mobivtt', 'license_key') as string,
        world_id: game.world?.id,
        plan: plan.plan_type,
        metadata: { current_count: synced, character_limit: plan.character_limit },
    });
    return true;
}

export const getUrl = (path: string) => {
    return `${__MOBIVTT_WEB__}/${path}`;
}

export const hasLicense = () => {

    const license = game.settings.get('mobivtt', 'license_key');
    return license.trim() !== '';
}

export interface PlanInfo {
    plan_type: string;
    character_limit: number;
}

export const validateLicense = async (): Promise<PlanInfo | null> => {
    if(!hasLicense()){
        return null;
    }
    const accessCode = game.settings.get('mobivtt', 'license_key');
    const res = await fetch(getUrl('api/subscribe/validate'), {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            access_code: accessCode
        })
    });
    if (res.ok) {
        const data = await res.json() as { success: boolean; plan_type?: string; character_limit?: number };
        if (data.success && data.plan_type && data.character_limit !== undefined) {
            metricsCollector.setAccessCode(accessCode as string);
            metricsCollector.track(
                'access_code_validated',
                'infrastructure',
                'addon',
                {
                    plan: data.plan_type,
                    access_code: accessCode,
                }
            );
            return { plan_type: data.plan_type, character_limit: data.character_limit };
        }
    }
    return null;
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

    game.settings.register('mobivtt', 'send_analytics', {
        name: 'Share usage analytics',
        hint: 'Send anonymous usage events (sync activity, errors, plan limits) to help improve MobiVTT. '
            + 'Character sheet data is never included. Uncheck to stop sending them; sync itself is unaffected.',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        onChange: (value: boolean) => metricsCollector.setEnabled(value),
    });

    metricsCollector.setEnabled(game.settings.get('mobivtt', 'send_analytics') as boolean);

}
