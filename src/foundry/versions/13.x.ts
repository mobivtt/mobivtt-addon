import {getUrl, validateLicense} from "../../settings";

export const config = () => {
    Hooks.on('renderSettingsConfig', (app, html, context) => {

        const labelElement = $(`label[for="settings-config-mobivtt.license_key"]`, html);
        const licenseKeyElement = $(`label[for="settings-config-mobivtt.license_key"]`, html).parent();

        validateLicense().then((licenseValid) => {
            labelElement.append(`<i class="fas fa-octagon-${licenseValid ? 'check' : 'xmark'}" style="margin-left:5px; color: ${licenseValid ? '#079d75' : '#9d072a'};"></i>`)

            if (licenseValid) {
                licenseKeyElement.after(`
                            <div class="form-group">
                                <label>Enabled characters for MobiVTT:</label>
                                <div class="form-fields">
                                    <span>${game.actors?.contents.filter(char=>char.getFlag("mobivtt","sync")).length}</span>
                                </div>
                                <p class="hint">You can enable/disable sync for each character individually on the top of character's sheet</p>
                            </div>
                        `)
                licenseKeyElement.after(`
                            <div class="form-group">
                                <label>Manage your license</label>
                                <div class="form-fields">
                                    <a href="${getUrl('signin')}" target="_blank">Sign in <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                                </div>
                            </div>
                        `)
            }else{
                licenseKeyElement.after(`
                            <div class="form-group">
                                <label>Don't have an access code?</label>
                                <div class="form-fields">
                                    <a href="${getUrl('signup')}" target="_blank">Get Forever Free access code <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                                </div>
                                <p class="hint">No card required.</p>
                            </div>
                        `)
            }
        });
    });
}
