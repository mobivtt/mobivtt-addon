import { vi, describe, it, expect } from 'vitest';

vi.stubGlobal('game', {
    i18n: { localize: (key: string) => key },
});

// Import AFTER stubGlobal — mapSystem reads game.i18n at call time.
const { mapSystem } = await import('../system');

function makeActor(abilities: Record<string, any>): Actor {
    return {
        system: { abilities },
        items: { contents: [] },
        effects: [],
    } as unknown as Actor;
}

describe('mapSystem — ability attack bonus (5.x number vs 6.x object)', () => {
    it('collapses the 6.x object form { value: N } to the number N', () => {
        const result = mapSystem(makeActor({
            str: { value: 14, mod: 2, proficient: 1, save: { value: 5 }, attack: { roll: {}, value: 5, bonus: 0 } },
        }));
        expect(result.abilities.str.attack).toBe(5);
    });

    it('passes through the 5.x number form unchanged', () => {
        const result = mapSystem(makeActor({
            dex: { value: 16, mod: 3, proficient: 0, save: { value: 3 }, attack: 6 },
        }));
        expect(result.abilities.dex.attack).toBe(6);
    });

    it('omits attack when the ability has no attack bonus', () => {
        const result = mapSystem(makeActor({
            con: { value: 12, mod: 1, proficient: 0, save: { value: 1 } },
        }));
        expect(result.abilities.con.attack).toBeUndefined();
    });

    it('still collapses the object save form to a number', () => {
        const result = mapSystem(makeActor({
            str: { value: 14, mod: 2, proficient: 1, save: { value: 5 } },
        }));
        expect(result.abilities.str.save).toBe(5);
    });
});
