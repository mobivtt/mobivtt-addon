import { vi, describe, it, expect } from 'vitest';

vi.stubGlobal('game', {
    i18n: { localize: (key: string) => key },
    packs: new Map(),
});

vi.mock('../../srd-registry', () => ({
    isSrdIdentifier: () => false,
    buildSrdRegistry: vi.fn(),
}));

vi.mock('../../translate', () => ({
    translateItems: vi.fn().mockResolvedValue(new Map()),
    translateSkills: vi.fn().mockResolvedValue(new Map()),
    translateConditions: vi.fn().mockResolvedValue(new Map()),
    buildI18nLabels: vi.fn().mockReturnValue({}),
}));

vi.mock('../sanitize', () => ({
    stripEnrichedText: (s: string) => s,
    setItemNameMap: vi.fn(),
}));

const { DnD5eExporter } = await import('../../exporter');

describe('DnD5eExporter — version routing via selectHandler', () => {
    it('constructs without error for 4.x version', () => {
        expect(() => new DnD5eExporter('4.4.0')).not.toThrow();
    });

    it('constructs without error for 5.x version', () => {
        expect(() => new DnD5eExporter('5.3.1')).not.toThrow();
    });

    it('constructs for 5.0.0 (boundary — major=5 is >= 5)', () => {
        expect(() => new DnD5eExporter('5.0.0')).not.toThrow();
    });

    it('constructs for 4.9.9 (boundary — major=4 is < 5)', () => {
        expect(() => new DnD5eExporter('4.9.9')).not.toThrow();
    });

    it('constructs for future versions like 6.0.0', () => {
        expect(() => new DnD5eExporter('6.0.0')).not.toThrow();
    });
});

describe('DnD5eExporter — version routing produces correct handler', () => {
    it('4.x version uses 4.x system mapper (different save parsing)', async () => {
        const exporter4x = new DnD5eExporter('4.4.0');
        const actor = {
            type: 'character',
            name: 'Test',
            items: {
                contents: [],
            },
            system: {
                abilities: { str: { value: 10, mod: 0, save: '!3!' } },
                attributes: { hp: { value: 10, max: 10, temp: 0 } },
            },
            effects: [],
        };

        const mockItem = { id: 'test', _id: 'test', name: 'Test', toObject: () => ({ _id: 'test', name: 'Test', type: 'feat', system: {} }) };
        actor.items.contents = [mockItem] as any;

        const result = await exporter4x.export(actor as unknown as Actor);
        expect(result).not.toBeNull();
        expect(result!.abilities.str.save).toBe(3);
    });

    it('5.x version uses 5.x system mapper (object save)', async () => {
        const exporter5x = new DnD5eExporter('5.3.1');
        const actor = {
            type: 'character',
            name: 'Test',
            items: {
                contents: [],
            },
            system: {
                abilities: { str: { value: 10, mod: 0, save: { value: 5 } } },
                attributes: { hp: { value: 10, max: 10, temp: 0 } },
            },
            effects: [],
        };

        const mockItem = { id: 'test', _id: 'test', name: 'Test', toObject: () => ({ _id: 'test', name: 'Test', type: 'feat', system: {} }) };
        actor.items.contents = [mockItem] as any;

        const result = await exporter5x.export(actor as unknown as Actor);
        expect(result).not.toBeNull();
        expect(result!.abilities.str.save).toBe(5);
    });
});

describe('DnD5eExporter — non-character actor filtering', () => {
    it('returns null for non-character actors', async () => {
        const exporter = new DnD5eExporter('5.3.1');
        const npcActor = {
            type: 'npc',
            name: 'Goblin',
            items: { contents: [] },
            system: {},
            effects: [],
        };

        const result = await exporter.export(npcActor as unknown as Actor);
        expect(result).toBeNull();
    });
});

describe('version parsing logic', () => {
    it('parseInt("4.4.0".split(".")[0]) === 4', () => {
        expect(parseInt('4.4.0'.split('.')[0], 10)).toBe(4);
        expect(parseInt('4.4.0'.split('.')[0], 10) >= 5).toBe(false);
    });

    it('parseInt("5.3.1".split(".")[0]) === 5', () => {
        expect(parseInt('5.3.1'.split('.')[0], 10)).toBe(5);
        expect(parseInt('5.3.1'.split('.')[0], 10) >= 5).toBe(true);
    });

    it('parseInt("5.0.0".split(".")[0]) >= 5 is true (boundary)', () => {
        expect(parseInt('5.0.0'.split('.')[0], 10) >= 5).toBe(true);
    });

    it('parseInt("4.9.9".split(".")[0]) >= 5 is false (boundary)', () => {
        expect(parseInt('4.9.9'.split('.')[0], 10) >= 5).toBe(false);
    });
});
