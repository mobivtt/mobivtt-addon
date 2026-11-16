/// <reference types="fvtt-types" />
import type {
    AbilityId, SkillId, Ability, Skill, HitPoints, DeathSaves, Movement,
    SpellcastingInfo, SpellSlot, PactSlot, Currency, CharacterResources,
    Resource, CharacterDetails, Proficiencies, ConditionInfo,
} from '../../../types/character';
import { stripEnrichedText } from './sanitize';
import type { SystemFields } from './system';
import type { SkillTranslation, ConditionTranslation } from '../translate';

const ABILITY_KEYS: AbilityId[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const ABILITY_I18N: Record<AbilityId, string> = {
    str: 'DND5E.AbilityStr', dex: 'DND5E.AbilityDex', con: 'DND5E.AbilityCon',
    int: 'DND5E.AbilityInt', wis: 'DND5E.AbilityWis', cha: 'DND5E.AbilityCha',
};

const SKILL_KEYS: SkillId[] = [
    'acr', 'ani', 'arc', 'ath', 'dec', 'his', 'ins', 'itm',
    'inv', 'med', 'nat', 'prc', 'prf', 'per', 'rel', 'slt', 'ste', 'sur',
];

const SKILL_I18N: Record<SkillId, string> = {
    acr: 'DND5E.SkillAcr', ani: 'DND5E.SkillAni', arc: 'DND5E.SkillArc',
    ath: 'DND5E.SkillAth', dec: 'DND5E.SkillDec', his: 'DND5E.SkillHis',
    ins: 'DND5E.SkillIns', itm: 'DND5E.SkillItm', inv: 'DND5E.SkillInv',
    med: 'DND5E.SkillMed', nat: 'DND5E.SkillNat', prc: 'DND5E.SkillPrc',
    prf: 'DND5E.SkillPrf', per: 'DND5E.SkillPer', rel: 'DND5E.SkillRel',
    slt: 'DND5E.SkillSlt', ste: 'DND5E.SkillSte', sur: 'DND5E.SkillSur',
};

const SPELL_SLOT_KEYS = [
    'spell1', 'spell2', 'spell3', 'spell4', 'spell5',
    'spell6', 'spell7', 'spell8', 'spell9',
] as const;

const RESOURCE_KEYS = ['primary', 'secondary', 'tertiary'] as const;

export function mapSystem4x(
    actor: Actor,
    skillTranslations?: Map<string, SkillTranslation>,
    conditionTranslations?: Map<string, ConditionTranslation>,
): SystemFields {
    const sys = actor.system as Record<string, any>;
    const attr = sys.attributes ?? {};
    const { spellSlots, pactSlot } = mapSpellSlots(sys);

    return {
        level: sys.details?.level ?? 0,
        abilities: mapAbilities(sys),
        skills: mapSkills(sys, skillTranslations),
        hp: mapHp(attr),
        ac: attr.ac?.value ?? 0,
        initiative: attr.init?.total ?? 0,
        proficiencyBonus: attr.prof ?? 0,
        inspiration: attr.inspiration ?? false,
        deathSaves: mapDeathSaves(attr),
        movement: mapMovement(sys),
        size: sys.traits?.size ?? 'med',
        passivePerception: sys.skills?.prc?.passive ?? 10,
        conditions: mapConditions(actor, conditionTranslations),
        exhaustion: mapExhaustion(sys),
        spellcasting: mapSpellcasting(sys, actor),
        spellSlots,
        ...(pactSlot ? { pactSlot } : {}),
        currency: mapCurrency(sys),
        resources: mapResources(sys),
        details: mapDetails(sys),
        proficiencies: mapProficiencies(sys),
    };
}

/**
 * 4.x ability save parsing.
 * dnd5e 4.x stores save as a string like "!5!" (total save bonus encoded as !N!).
 * dnd5e 5.x stores save as an object { roll: {...}, value: N } (value computed at runtime).
 */
function mapAbilities(sys: Record<string, any>): Record<AbilityId, Ability> {
    const sysAbilities = sys.abilities ?? {};
    const abilities = {} as Record<AbilityId, Ability>;
    for (const key of ABILITY_KEYS) {
        const ab = sysAbilities[key] ?? {};
        const rawSave = ab.save;
        const saveValue = typeof rawSave === 'string'
            ? parseInt(rawSave.replace(/!/g, ''), 10)
            : typeof rawSave === 'object'
                ? (rawSave?.value ?? 0)
                : (rawSave ?? 0);
        const result: Ability = {
            label: (game as any).i18n.localize(ABILITY_I18N[key]),
            value: ab.value ?? 0,
            mod: ab.mod ?? 0,
            saveProficient: ab.proficient ?? 0,
            save: isNaN(saveValue) ? 0 : saveValue,
            ...(ab.attack != null ? { attack: ab.attack } : {}),
        };
        abilities[key] = result;
    }
    return abilities;
}

function mapSkills(
    sys: Record<string, any>,
    translations?: Map<string, SkillTranslation>,
): Record<SkillId, Skill> {
    const sysSkills = sys.skills ?? {};
    const skills = {} as Record<SkillId, Skill>;
    for (const key of SKILL_KEYS) {
        const sk = sysSkills[key] ?? {};
        const t = translations?.get(key);
        const result: Skill = {
            label: t?.label ?? (game as any).i18n.localize(SKILL_I18N[key]),
            ability: sk.ability ?? 'str',
            proficient: sk.proficient ?? 0,
            total: sk.total ?? 0,
        };
        if (t?.description) result.description = t.description;
        if (key === 'prc') result.passive = sk.passive ?? 10;
        skills[key] = result;
    }
    return skills;
}

function mapHp(attr: Record<string, any>): HitPoints {
    const hp = attr.hp ?? {};
    return { value: hp.value ?? 0, max: hp.max ?? 0, temp: hp.temp ?? 0 };
}

function mapDeathSaves(attr: Record<string, any>): DeathSaves {
    const death = attr.death ?? {};
    return { success: death.success ?? 0, failure: death.failure ?? 0 };
}

function mapMovement(sys: Record<string, any>): Movement {
    const m = sys.attributes?.movement ?? {};
    return {
        walk: m.walk ?? 0,
        fly: m.fly ?? 0,
        swim: m.swim ?? 0,
        climb: m.climb ?? 0,
        burrow: m.burrow ?? 0,
    };
}

function mapSpellcasting(sys: Record<string, any>, actor: Actor): SpellcastingInfo | null {
    const ability = sys.attributes?.spellcasting;
    if (!ability) return null;

    const spell = sys.attributes?.spell ?? {};
    const maxPrepared = (actor.items as any).contents
        .filter((i: any) => i.type === 'class' && i.system?.spellcasting?.preparation?.max != null)
        .reduce((sum: number, c: any) => sum + (c.system.spellcasting.preparation.max ?? 0), 0) || null;

    return {
        ability: ability as AbilityId,
        attack: spell.attack ?? 0,
        dc: spell.dc ?? 0,
        mod: spell.mod ?? 0,
        maxPrepared,
    };
}

function mapSpellSlots(sys: Record<string, any>): { spellSlots: Record<number, SpellSlot>; pactSlot?: PactSlot } {
    const sysSpells = sys.spells ?? {};
    const spellSlots: Record<number, SpellSlot> = {};

    for (const key of SPELL_SLOT_KEYS) {
        const sl = sysSpells[key] ?? {};
        const level = sl.level ?? parseInt(key.replace('spell', ''));
        if ((sl.max ?? 0) > 0) {
            spellSlots[level] = { value: sl.value ?? 0, max: sl.max ?? 0 };
        }
    }

    const pactData = sysSpells.pact ?? {};
    let pactSlot: PactSlot | undefined;
    if ((pactData.max ?? 0) > 0) {
        pactSlot = {
            value: pactData.value ?? 0,
            max: pactData.max ?? 0,
            level: pactData.level ?? 0,
        };
    }

    return { spellSlots, pactSlot };
}

function mapCurrency(sys: Record<string, any>): Currency {
    const c = sys.currency ?? {};
    return { pp: c.pp ?? 0, gp: c.gp ?? 0, ep: c.ep ?? 0, sp: c.sp ?? 0, cp: c.cp ?? 0 };
}

function mapResources(sys: Record<string, any>): CharacterResources {
    const r = sys.resources ?? {};
    const resources = {} as CharacterResources;
    for (const key of RESOURCE_KEYS) {
        const res = r[key] ?? {};
        resources[key] = {
            value: res.value ?? 0,
            max: res.max ?? 0,
            label: res.label ?? '',
            sr: res.sr ?? false,
            lr: res.lr ?? false,
        } satisfies Resource;
    }
    return resources;
}

function mapDetails(sys: Record<string, any>): CharacterDetails {
    const d = sys.details ?? {};
    return {
        alignment: d.alignment ?? '',
        creatureType: d.type?.value ?? 'humanoid',
        biography: stripEnrichedText(d.biography?.value ?? ''),
        trait: stripEnrichedText(d.trait ?? ''),
        ideal: stripEnrichedText(d.ideal ?? ''),
        bond: stripEnrichedText(d.bond ?? ''),
        flaw: stripEnrichedText(d.flaw ?? ''),
    };
}

function mapConditions(
    actor: Actor,
    translations?: Map<string, ConditionTranslation>,
): ConditionInfo[] {
    if (!(actor as any).effects) return [];
    const ids = Array.from((actor as any).effects)
        .filter((e: any) => !e.disabled && e.statuses?.size > 0)
        .flatMap((e: any) => [...e.statuses])
        .filter((id: string) => id !== 'exhaustion' && id !== 'dead');
    const unique = [...new Set(ids)];
    return unique.map(id => {
        const t = translations?.get(id);
        return {
            id,
            label: t?.label ?? id,
            description: t?.description ?? '',
        };
    });
}

function mapExhaustion(sys: Record<string, any>): number {
    return sys.attributes?.exhaustion ?? 0;
}

function mapProficiencies(sys: Record<string, any>): Proficiencies {
    const t = sys.traits ?? {};
    const langRaw = t.languages?.labels?.languages;

    const weaponVal = t.weaponProf?.value;
    const weapons = Array.isArray(weaponVal) ? [...weaponVal] : [];

    const armorVal = t.armorProf?.value;
    const armor = Array.isArray(armorVal) ? [...armorVal] : [];

    const tools: Record<string, { total: number }> = {};
    const sysTools = sys.tools;
    if (sysTools && typeof sysTools === 'object') {
        for (const key of Object.keys(sysTools)) {
            const tool = sysTools[key];
            if (tool && typeof tool === 'object') {
                tools[key] = { total: tool.total ?? 0 };
            }
        }
    }

    return {
        weapons,
        armor,
        languages: Array.isArray(langRaw) ? [...langRaw] : [],
        tools,
    };
}
