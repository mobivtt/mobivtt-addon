import { vi, describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.stubGlobal('game', {
    i18n: { localize: (key: string) => key },
    packs: new Map(),
});

vi.mock('../../srd-registry', () => ({
    isSrdIdentifier: () => false,
}));

const { mapContent4x } = await import('../items.4.x');

function loadFixture(name: string): { systemData: Record<string, any>; items: Record<string, any>[] } {
    const fixtureDir = resolve(__dirname, '../../../../../../tests/fixtures/foundry-12.331');
    return JSON.parse(readFileSync(resolve(fixtureDir, `${name}.json`), 'utf-8'));
}

function resolvedItemsFrom(fixture: ReturnType<typeof loadFixture>): Record<string, any>[] {
    return fixture.items.map((i: Record<string, any>) => ({
        ...i,
        _id: i._id ?? `mock-${i.name}`,
        system: i.systemData,
    }));
}

function makeActor(fixture: ReturnType<typeof loadFixture>): unknown {
    return {
        system: fixture.systemData,
        items: {
            contents: fixture.items.map((i: Record<string, any>) => ({
                ...i,
                id: i._id ?? `mock-${i.name}`,
                _id: i._id ?? `mock-${i.name}`,
                system: i.systemData,
            })),
        },
        effects: [],
    };
}

describe('mapContent4x — spell preparation (4.x boolean vs 5.x number)', () => {
    it('reads prepared=false (boolean) from 4.x fixture spell', () => {
        const spellItem = {
            _id: 'spell1',
            type: 'spell',
            name: 'Fireball',
            system: {
                level: 3,
                preparation: { mode: 'prepared', prepared: false },
                range: { value: 150, units: 'ft' },
            },
        };
        const actor = {
            items: { contents: [{ ...spellItem, id: 'spell1' }] },
        };

        const result = mapContent4x([spellItem], actor as unknown as Actor);
        expect(result.spells).toHaveLength(1);
        expect(result.spells[0].preparation.prepared).toBe(false);
        expect(result.spells[0].preparation.mode).toBe('prepared');
    });

    it('reads prepared=true (boolean) from 4.x fixture spell', () => {
        const spellItem = {
            _id: 'spell2',
            type: 'spell',
            name: 'Shield',
            system: {
                level: 1,
                preparation: { mode: 'prepared', prepared: true },
                range: { value: null, units: 'self' },
            },
        };
        const actor = {
            items: { contents: [{ ...spellItem, id: 'spell2' }] },
        };

        const result = mapContent4x([spellItem], actor as unknown as Actor);
        expect(result.spells).toHaveLength(1);
        expect(result.spells[0].preparation.prepared).toBe(true);
    });

    it('falls back to sys.prepared number when preparation.prepared is absent (5.x compat)', () => {
        const spellItem = {
            _id: 'spell3',
            type: 'spell',
            name: 'Magic Missile',
            system: {
                level: 1,
                preparation: { mode: 'always' },
                prepared: 1,
                range: { value: 120, units: 'ft' },
            },
        };
        const actor = {
            items: { contents: [{ ...spellItem, id: 'spell3' }] },
        };

        const result = mapContent4x([spellItem], actor as unknown as Actor);
        expect(result.spells[0].preparation.prepared).toBe(true);
    });

    it('treats prepared=0 as false when falling back to number', () => {
        const spellItem = {
            _id: 'spell4',
            type: 'spell',
            name: 'Counterspell',
            system: {
                level: 3,
                preparation: {},
                prepared: 0,
                range: { value: 60, units: 'ft' },
            },
        };
        const actor = {
            items: { contents: [{ ...spellItem, id: 'spell4' }] },
        };

        const result = mapContent4x([spellItem], actor as unknown as Actor);
        expect(result.spells[0].preparation.prepared).toBe(false);
    });
});

describe('mapContent4x — Sir Plalalantin fixture spells', () => {
    let result: ReturnType<typeof mapContent4x>;

    beforeAll(() => {
        const fixture = loadFixture('sir-plalalantin');
        const items = resolvedItemsFrom(fixture);
        const actor = makeActor(fixture);
        result = mapContent4x(items, actor as Actor);
    });

    it('extracts all spells from fixture', () => {
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Divine Smite');
        expect(spellNames).toContain('Bless');
        expect(spellNames).toContain('Shield of Faith');
        expect(spellNames).toContain('Command');
    });

    it('all spells have preparation.prepared = false (none prepared in fixture)', () => {
        for (const spell of result.spells) {
            expect(spell.preparation.prepared).toBe(false);
        }
    });

    it('all spells have preparation.mode = "prepared"', () => {
        for (const spell of result.spells) {
            expect(spell.preparation.mode).toBe('prepared');
        }
    });

    it('maps spell level correctly', () => {
        const divineSmite = result.spells.find(s => s.name === 'Divine Smite');
        expect(divineSmite?.level).toBe(1);
    });

    it('maps spell range', () => {
        const shieldOfFaith = result.spells.find(s => s.name === 'Shield of Faith');
        expect(shieldOfFaith?.range.value).toBe(60);
        expect(shieldOfFaith?.range.units).toBe('ft');
    });

    it('maps spell identifier', () => {
        const bless = result.spells.find(s => s.name === 'Bless');
        expect(bless?.identifier).toBe('bless');
    });
});

describe('mapContent4x — weapon damage (same in 4.x and 5.x)', () => {
    let result: ReturnType<typeof mapContent4x>;

    beforeAll(() => {
        const fixture = loadFixture('gronk-refundcrusher');
        const items = resolvedItemsFrom(fixture);
        const actor = makeActor(fixture);
        result = mapContent4x(items, actor as Actor);
    });

    it('maps weapon damage.base format', () => {
        const spear = result.inventory.find(i => i.name === 'Spear');
        expect(spear).toBeDefined();
        expect(spear?.category).toBe('weapon');
        const weapon = spear as { category: 'weapon'; damage?: { number: number | null; denomination: number | null; types: string[] } };
        expect(weapon.damage?.number).toBe(1);
        expect(weapon.damage?.denomination).toBe(6);
        expect(weapon.damage?.types).toContain('piercing');
    });

    it('maps weapon range', () => {
        const shortbow = result.inventory.find(i => i.name === 'Shortbow');
        expect(shortbow).toBeDefined();
        const weapon = shortbow as { range?: { value: number | null; units: string; long?: number } };
        expect(weapon.range?.value).toBe(80);
        expect(weapon.range?.long).toBe(320);
    });

    it('maps weapon properties', () => {
        const spear = result.inventory.find(i => i.name === 'Spear');
        const weapon = spear as { properties?: string[] };
        expect(weapon.properties).toContain('thr');
        expect(weapon.properties).toContain('ver');
    });
});

describe('mapContent4x — class, race, background', () => {
    let result: ReturnType<typeof mapContent4x>;

    beforeAll(() => {
        const fixture = loadFixture('gronk-refundcrusher');
        const items = resolvedItemsFrom(fixture);
        const actor = makeActor(fixture);
        result = mapContent4x(items, actor as Actor);
    });

    it('maps class with levels and hit die', () => {
        expect(result.classes).toHaveLength(1);
        expect(result.classes[0].name).toBe('Barbarian');
        expect(result.classes[0].levels).toBe(3);
        expect(result.classes[0].hitDie.denomination).toBe('d12');
    });

    it('maps subclass from subclass item', () => {
        expect(result.classes[0].subclass).toBe('Path of the Berserker');
    });

    it('maps race name', () => {
        expect(result.race).toBe('Orc');
    });

    it('maps background name', () => {
        expect(result.background).toBe('Soldier');
    });
});

describe('mapContent4x — features', () => {
    let result: ReturnType<typeof mapContent4x>;

    beforeAll(() => {
        const fixture = loadFixture('gronk-refundcrusher');
        const items = resolvedItemsFrom(fixture);
        const actor = makeActor(fixture);
        result = mapContent4x(items, actor as Actor);
    });

    it('maps feat-type features', () => {
        const savageAttacker = result.features.find(f => f.name === 'Savage Attacker');
        expect(savageAttacker).toBeDefined();
        expect(savageAttacker?.source).toBe('feat');
    });

    it('maps race-type features', () => {
        const adrenalineRush = result.features.find(f => f.name === 'Adrenaline Rush');
        expect(adrenalineRush).toBeDefined();
        expect(adrenalineRush?.source).toBe('race');
    });

    it('maps feature uses when present', () => {
        const adrenalineRush = result.features.find(f => f.name === 'Adrenaline Rush');
        expect(adrenalineRush?.uses).toBeDefined();
        expect(adrenalineRush?.uses?.max).toBe(2);
    });
});

describe('mapContent4x — consumables and equipment', () => {
    let result: ReturnType<typeof mapContent4x>;

    beforeAll(() => {
        const fixture = loadFixture('gronk-refundcrusher');
        const items = resolvedItemsFrom(fixture);
        const actor = makeActor(fixture);
        result = mapContent4x(items, actor as Actor);
    });

    it('maps consumable items', () => {
        const arrow = result.inventory.find(i => i.name === 'Arrow');
        expect(arrow).toBeDefined();
        expect(arrow?.category).toBe('consumable');
        expect(arrow?.quantity).toBe(20);
    });

    it('maps gear items (equipment/container)', () => {
        const clothes = result.inventory.find(i => i.name === "Traveler's Clothes");
        expect(clothes).toBeDefined();
        expect(clothes?.category).toBe('gear');
    });

    it('maps container items as gear', () => {
        const quiver = result.inventory.find(i => i.name === 'Quiver');
        expect(quiver).toBeDefined();
        expect(quiver?.category).toBe('gear');
    });
});
