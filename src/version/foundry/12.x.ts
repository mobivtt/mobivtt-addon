import {getUrl, validateLicense} from "../../settings";

export const config= () => {
    Hooks.on('renderSettingsConfig', (app, html, context) => {
        const labelElement = $(`[data-setting-id="mobivtt.license_key"] label`, html);
        const licenseKeyElement = $(`[data-setting-id="mobivtt.license_key"]`, html);

        validateLicense().then((licenseValid) => {
            labelElement.append(`<i class="fas fa-octagon-${licenseValid ? 'check' : 'xmark'}" style="margin-left:5px; color: ${licenseValid ? '#079d75' : '#9d072a'};"></i>`)

            if (licenseValid) {
                licenseKeyElement.after(`
                            <div class="form-group">
                                <label>Enabled characters for MobiVTT:</label>
                                <span>${game.actors?.contents.filter(char=>char.getFlag("mobivtt","sync")).length}</span>
                                <p class="notes">You can enable/disable sync for each character individually on the top of character's sheet</p>
                            </div>
                        `)
                licenseKeyElement.after(`
                            <div class="form-group">
                                <label>Clear MobiVTT worlds/characters</label>
                                <a href="${getUrl(`clearWorld/${game.settings.get('mobivtt', 'license_key')}`)}" target="_blank">Purge cloud data <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                                <p class="notes">This action will purge cloud data for your license key so you can re-sync. Same access code can be used for multiple worlds, as long as only 1 world is active.</p>
                            </div>
                        `)
                licenseKeyElement.after(`
                            <div class="form-group">
                                <label>Manage your license</label>
                                <a href="${getUrl('signin')}" target="_blank">Sign in <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                            </div>
                        `)

            }else{
                licenseKeyElement.after(`
                            <div class="form-group">
                                <label>Don't have an access code?</label>
                                <a href="${getUrl('signup')}" target="_blank">Get Forever Free access code <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                                <p class="notes">No card required.</p>
                            </div>
                        `)
            }
        });
    });
}
