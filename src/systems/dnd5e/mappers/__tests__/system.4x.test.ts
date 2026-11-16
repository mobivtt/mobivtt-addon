import { vi, describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.stubGlobal('game', {
    i18n: { localize: (key: string) => key },
});

// Dynamic import AFTER stubGlobal — mapSystem4x reads game.i18n at call time
const { mapSystem4x } = await import('../system.4.x');

function loadFixture(name: string): { systemData: Record<string, any>; items: Record<string, any>[] } {
    const fixtureDir = resolve(__dirname, '../../../../../../tests/fixtures/foundry-12.331');
    return JSON.parse(readFileSync(resolve(fixtureDir, `${name}.json`), 'utf-8'));
}

function makeActor(fixture: ReturnType<typeof loadFixture>): unknown {
    return {
        system: fixture.systemData,
        items: {
            contents: fixture.items.map((i: Record<string, any>) => ({
                ...i,
                system: i.systemData,
            })),
        },
        effects: [],
    };
}

describe('mapSystem4x — Gronk Refundcrusher (4.x fixture)', () => {
    let result: ReturnType<typeof mapSystem4x>;

    beforeAll(() => {
        const fixture = loadFixture('gronk-refundcrusher');
        result = mapSystem4x(makeActor(fixture) as Actor);
    });

    describe('ability save parsing (4.x "!N!" strings)', () => {
        it('parses STR save "!5!" → 5', () => {
            expect(result.abilities.str.save).toBe(5);
        });

        it('parses DEX save "!1!" → 1', () => {
            expect(result.abilities.dex.save).toBe(1);
        });

        it('parses CON save "!4!" → 4', () => {
            expect(result.abilities.con.save).toBe(4);
        });

        it('parses INT save "!0!" → 0', () => {
            expect(result.abilities.int.save).toBe(0);
        });

        it('parses WIS save "!0!" → 0', () => {
            expect(result.abilities.wis.save).toBe(0);
        });

        it('parses CHA save "!0!" → 0', () => {
            expect(result.abilities.cha.save).toBe(0);
        });
    });

    describe('ability values', () => {
        it('reads STR value=17, mod=3', () => {
            expect(result.abilities.str.value).toBe(17);
            expect(result.abilities.str.mod).toBe(3);
        });

        it('reads DEX value=13, mod=1', () => {
            expect(result.abilities.dex.value).toBe(13);
            expect(result.abilities.dex.mod).toBe(1);
        });

        it('reads CON value=14, mod=2', () => {
            expect(result.abilities.con.value).toBe(14);
            expect(result.abilities.con.mod).toBe(2);
        });

        it('maps saveProficient from fixture proficient field', () => {
            expect(result.abilities.str.saveProficient).toBe(1);
            expect(result.abilities.dex.saveProficient).toBe(0);
            expect(result.abilities.con.saveProficient).toBe(1);
        });

        it('maps attack bonus when present', () => {
            expect(result.abilities.str.attack).toBe(5);
            expect(result.abilities.dex.attack).toBe(3);
        });
    });

    describe('ability labels use i18n keys', () => {
        it('labels abilities with DND5E i18n keys', () => {
            expect(result.abilities.str.label).toBe('DND5E.AbilityStr');
            expect(result.abilities.dex.label).toBe('DND5E.AbilityDex');
            expect(result.abilities.cha.label).toBe('DND5E.AbilityCha');
        });
    });

    describe('skills (4.x has pre-computed total/passive)', () => {
        it('reads acr total=1', () => {
            expect(result.skills.acr.total).toBe(1);
        });

        it('reads ath total=5 (proficient)', () => {
            expect(result.skills.ath.total).toBe(5);
            expect(result.skills.ath.proficient).toBe(1);
        });

        it('reads ani total=2 (proficient)', () => {
            expect(result.skills.ani.total).toBe(2);
            expect(result.skills.ani.proficient).toBe(1);
        });

        it('maps skill ability correctly', () => {
            expect(result.skills.acr.ability).toBe('dex');
            expect(result.skills.ath.ability).toBe('str');
            expect(result.skills.prc.ability).toBe('wis');
        });

        it('includes passive on perception skill', () => {
            expect(result.skills.prc.passive).toBe(10);
        });

        it('labels skills with i18n keys', () => {
            expect(result.skills.acr.label).toBe('DND5E.SkillAcr');
            expect(result.skills.ath.label).toBe('DND5E.SkillAth');
        });
    });

    describe('hit points', () => {
        it('maps HP value and max from fixture', () => {
            expect(result.hp.value).toBe(31);
            expect(result.hp.max).toBe(32);
        });

        it('handles null temp as 0', () => {
            expect(result.hp.temp).toBe(0);
        });
    });

    describe('derived fields default to 0 for raw fixture data', () => {
        it('level defaults to 0 (computed from class items at runtime)', () => {
            expect(result.level).toBe(0);
        });

        it('ac defaults to 0', () => {
            expect(result.ac).toBe(0);
        });

        it('initiative defaults to 0', () => {
            expect(result.initiative).toBe(0);
        });

        it('proficiencyBonus defaults to 0', () => {
            expect(result.proficiencyBonus).toBe(0);
        });

        it('inspiration is false', () => {
            expect(result.inspiration).toBe(false);
        });
    });

    describe('death saves', () => {
        it('maps death save successes and failures', () => {
            expect(result.deathSaves.success).toBe(0);
            expect(result.deathSaves.failure).toBe(0);
        });
    });

    describe('movement', () => {
        it('maps walk speed from fixture', () => {
            expect(result.movement.walk).toBe(30);
        });

        it('maps other movement types as 0', () => {
            expect(result.movement.fly).toBe(0);
            expect(result.movement.swim).toBe(0);
            expect(result.movement.climb).toBe(0);
            expect(result.movement.burrow).toBe(0);
        });
    });

    describe('size and passive perception', () => {
        it('maps size from traits', () => {
            expect(result.size).toBe('med');
        });

        it('maps passive perception from skills.prc.passive', () => {
            expect(result.passivePerception).toBe(10);
        });
    });

    describe('spellcasting (Gronk is a non-caster)', () => {
        it('returns null when no spellcasting ability set', () => {
            expect(result.spellcasting).toBeNull();
        });

        it('maps no spell slots (max=0 for all levels)', () => {
            expect(Object.keys(result.spellSlots)).toHaveLength(0);
        });

        it('has no pact slot', () => {
            expect(result.pactSlot).toBeUndefined();
        });
    });

    describe('currency', () => {
        it('maps gp=29', () => {
            expect(result.currency.gp).toBe(29);
        });

        it('maps other currency as 0', () => {
            expect(result.currency.pp).toBe(0);
            expect(result.currency.ep).toBe(0);
            expect(result.currency.sp).toBe(0);
            expect(result.currency.cp).toBe(0);
        });
    });

    describe('conditions and exhaustion', () => {
        it('returns empty conditions with no effects', () => {
            expect(result.conditions).toEqual([]);
        });

        it('maps exhaustion as 0', () => {
            expect(result.exhaustion).toBe(0);
        });
    });

    describe('resources', () => {
        it('maps primary/secondary/tertiary with defaults', () => {
            expect(result.resources.primary.value).toBe(0);
            expect(result.resources.primary.max).toBe(0);
            expect(result.resources.primary.label).toBe('');
        });
    });

    describe('proficiencies', () => {
        it('maps weapon proficiencies', () => {
            expect(result.proficiencies.weapons).toEqual(['mar', 'sim']);
        });

        it('maps armor proficiencies', () => {
            expect(result.proficiencies.armor).toContain('lgt');
            expect(result.proficiencies.armor).toContain('med');
            expect(result.proficiencies.armor).toContain('shl');
        });

        it('maps empty languages', () => {
            expect(result.proficiencies.languages).toEqual([]);
        });

        it('maps empty tools', () => {
            expect(Object.keys(result.proficiencies.tools)).toHaveLength(0);
        });
    });

    describe('details', () => {
        it('maps alignment as empty string', () => {
            expect(result.details.alignment).toBe('');
        });

        it('maps creatureType to humanoid', () => {
            expect(result.details.creatureType).toBe('humanoid');
        });
    });
});

describe('mapSystem4x — Sir Plalalantin (4.x Paladin)', () => {
    let result: ReturnType<typeof mapSystem4x>;

    beforeAll(() => {
        const fixture = loadFixture('sir-plalalantin');
        result = mapSystem4x(makeActor(fixture) as Actor);
    });

    describe('ability saves', () => {
        it('parses STR save "!4!" → 4 (not proficient)', () => {
            expect(result.abilities.str.save).toBe(4);
            expect(result.abilities.str.saveProficient).toBe(0);
        });

        it('parses WIS save "!2!" → 2 (proficient)', () => {
            expect(result.abilities.wis.save).toBe(2);
            expect(result.abilities.wis.saveProficient).toBe(1);
        });

        it('parses CHA save "!2!" → 2 (proficient)', () => {
            expect(result.abilities.cha.save).toBe(2);
            expect(result.abilities.cha.saveProficient).toBe(1);
        });
    });

    describe('spellcasting', () => {
        it('maps spellcasting ability for paladin', () => {
            expect(result.spellcasting).not.toBeNull();
            expect(result.spellcasting!.ability).toBe('cha');
        });

        it('maps level 1 spell slots (max=3)', () => {
            expect(result.spellSlots[1]).toBeDefined();
            expect(result.spellSlots[1].max).toBe(3);
            expect(result.spellSlots[1].value).toBe(0);
        });

        it('omits spell slots with max=0', () => {
            expect(result.spellSlots[2]).toBeUndefined();
        });
    });

    describe('skills', () => {
        it('reads ath total=6 (proficient)', () => {
            expect(result.skills.ath.total).toBe(6);
            expect(result.skills.ath.proficient).toBe(1);
        });

        it('reads ins total=2 (proficient)', () => {
            expect(result.skills.ins.total).toBe(2);
            expect(result.skills.ins.proficient).toBe(1);
        });

        it('reads prc total=2 with passive=12', () => {
            expect(result.skills.prc.total).toBe(2);
            expect(result.skills.prc.passive).toBe(12);
        });
    });

    describe('tool proficiencies', () => {
        it('maps card gaming set with total=2', () => {
            expect(result.proficiencies.tools).toHaveProperty('card');
            expect(result.proficiencies.tools.card.total).toBe(2);
        });
    });

    describe('currency', () => {
        it('maps gp=23', () => {
            expect(result.currency.gp).toBe(23);
        });
    });
});

describe('mapSystem4x — edge cases', () => {
    it('handles missing ability save gracefully (undefined)', () => {
        const actor = {
            system: {
                abilities: { str: { value: 10, mod: 0 } },
                attributes: {},
            },
            items: { contents: [] },
            effects: [],
        };
        const result = mapSystem4x(actor as unknown as Actor);
        expect(result.abilities.str.save).toBe(0);
    });

    it('handles malformed save string "!abc!" as 0', () => {
        const actor = {
            system: {
                abilities: { str: { value: 10, mod: 0, save: '!abc!' } },
                attributes: {},
            },
            items: { contents: [] },
            effects: [],
        };
        const result = mapSystem4x(actor as unknown as Actor);
        expect(result.abilities.str.save).toBe(0);
    });

    it('handles numeric save as raw value', () => {
        const actor = {
            system: {
                abilities: { str: { value: 10, mod: 0, save: 7 } },
                attributes: {},
            },
            items: { contents: [] },
            effects: [],
        };
        const result = mapSystem4x(actor as unknown as Actor);
        expect(result.abilities.str.save).toBe(7);
    });

    it('handles 5.x-style object save { value: N } for forward compatibility', () => {
        const actor = {
            system: {
                abilities: { str: { value: 10, mod: 0, save: { value: 3 } } },
                attributes: {},
            },
            items: { contents: [] },
            effects: [],
        };
        const result = mapSystem4x(actor as unknown as Actor);
        expect(result.abilities.str.save).toBe(3);
    });

    it('handles completely empty systemData', () => {
        const actor = {
            system: {},
            items: { contents: [] },
            effects: [],
        };
        const result = mapSystem4x(actor as unknown as Actor);
        expect(result.level).toBe(0);
        expect(result.hp.value).toBe(0);
        expect(result.hp.max).toBe(0);
        expect(result.conditions).toEqual([]);
        expect(result.currency.gp).toBe(0);
    });
});
