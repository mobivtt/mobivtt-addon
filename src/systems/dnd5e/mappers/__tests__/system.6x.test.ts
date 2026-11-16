import { vi, describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.stubGlobal('game', {
    i18n: { localize: (key: string) => key },
});

// Dynamic import AFTER stubGlobal — mapSystem reads game.i18n at call time.
const { mapSystem } = await import('../system');

function loadFixture(name: string): { systemData: Record<string, any>; items: Record<string, any>[] } {
    const fixtureDir = resolve(__dirname, '../../../../../../tests/fixtures/foundry-14.370');
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

describe('mapSystem — Gronk Refundcrusher (real dnd5e 6.0.0 fixture)', () => {
    let result: ReturnType<typeof mapSystem>;

    beforeAll(() => {
        const fixture = loadFixture('gronk-refundcrusher');
        result = mapSystem(makeActor(fixture) as Actor);
    });

    describe('ability attack bonus (6.x nests attack as { value: N })', () => {
        it('collapses STR attack to 5', () => {
            expect(result.abilities.str.attack).toBe(5);
        });
        it('collapses DEX attack to 3', () => {
            expect(result.abilities.dex.attack).toBe(3);
        });
        it('collapses CON attack to 4', () => {
            expect(result.abilities.con.attack).toBe(4);
        });
    });

    describe('ability save (6.x nests save as { value: N })', () => {
        it('collapses STR save to 5', () => {
            expect(result.abilities.str.save).toBe(5);
        });
        it('collapses DEX save to 1', () => {
            expect(result.abilities.dex.save).toBe(1);
        });
    });

    it('maps stored ability score (STR 17)', () => {
        expect(result.abilities.str.value).toBe(17);
    });

    it('maps level 3', () => {
        expect(result.level).toBe(3);
    });

    it('maps currency (29 gp)', () => {
        expect(result.currency.gp).toBe(29);
    });

    it('maps size med', () => {
        expect(result.size).toBe('med');
    });
});
