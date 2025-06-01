/// <reference types="vite/client" />


export {}; // 👈 IMPORTANT! Forces this to be a module

declare global {
    declare const __MOBIVTT_WEB__: string;
    declare const game: Game;
    interface SettingConfig {
        "mobivtt.license_key": fields.StringField<{
            blank: true;
            initial: "";
        }>;
        "mobivtt.game_type": fields.StringField<{
            blank: true;
            initial: "";
            choices: {
                "GAME_DND5E": "Dungeons & Dragons Fifth Edition";
            };
        }>;
    }
}
