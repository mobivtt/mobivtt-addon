/// <reference types="fvtt-types" />
import type { Exporter, VersionHandler } from '../base/Exporter';
import type { Dnd5eCharacter, SpellDetail, SpellReference } from '../../types/character';
import { mapSystem as mapSystem5x, type SystemFields } from './mappers/system';
import { mapSystem4x } from './mappers/system.4.x';
import { mapContent as mapContent5x, type ContentFields } from './mappers/items';
import { mapContent4x } from './mappers/items.4.x';
import { mapSpellDetails as mapSpellDetails5x } from './mappers/spells';
import { mapSpellDetails4x } from './mappers/spells.4.x';
import { translateItems, translateSkills, translateConditions, buildI18nLabels } from './translate';
import { setItemNameMap } from './mappers/sanitize';

type DnD5eHandler = VersionHandler<SystemFields, ContentFields, Record<string, SpellDetail | SpellReference>>;

export class DnD5eExporter implements Exporter<Dnd5eCharacter> {
    private readonly handler: DnD5eHandler;

    constructor(systemVersion: string) {
        this.handler = this.selectHandler(systemVersion);
    }

    async export(actor: Actor): Promise<Dnd5eCharacter | null> {
        // @ts-ignore — fvtt-types doesn't model actor.type for dnd5e
        if (actor.type !== 'character') return null;

        const liveItems = (actor.items as any).contents as any[];
        const [translations, skillTranslations, conditionTranslations] = await Promise.all([
            translateItems(liveItems),
            translateSkills(),
            translateConditions(),
        ]);

        setItemNameMap(liveItems.map((i: any) => {
            const t = translations.get(i.id ?? i._id);
            return { id: i.id ?? i._id, _id: i._id, name: t?.name ?? i.name };
        }));

        const resolvedItems = liveItems.map((i: any) => {
            const obj = i.toObject(false);
            const t = translations.get(obj._id);
            if (t) {
                obj.name = t.name;
                if (obj.system?.description) {
                    obj.system.description.value = t.description;
                }
            }
            return obj;
        });

        const system = this.handler.mapSystem(actor, skillTranslations, conditionTranslations);
        const content = this.handler.mapContent(resolvedItems, actor);
        const spellDetails = this.handler.mapSpellDetails(actor, translations);

        return {
            name: actor.name || '',
            ...system,
            ...content,
            ...(Object.keys(spellDetails).length > 0 ? { spellDetails } : {}),
            i18n: buildI18nLabels(),
        };
    }

    private selectHandler(version: string): DnD5eHandler {
        const major = parseInt(version.split('.')[0], 10);
        if (major >= 5) {
            return { mapSystem: mapSystem5x, mapContent: mapContent5x, mapSpellDetails: mapSpellDetails5x };
        }
        return { mapSystem: mapSystem4x, mapContent: mapContent4x, mapSpellDetails: mapSpellDetails4x };
    }
}
