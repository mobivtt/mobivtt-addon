import { describe, it, expect } from 'vitest';
import { planRelayedRoll } from '../mobile-roll';

describe('planRelayedRoll', () => {
    it('groups mixed dice by face count and keeps the supplied values', () => {
        const plan = planRelayedRoll(
            [
                { type: 'd20', value: 17 },
                { type: 'd6', value: 3 },
                { type: 'd6', value: 5 },
            ],
            2
        );
        expect(plan).not.toBeNull();
        expect(plan!.dieTerms).toEqual([
            { faces: 20, values: [17] },
            { faces: 6, values: [3, 5] },
        ]);
        expect(plan!.modifier).toBe(2);
        expect(plan!.formula).toBe('1d20 + 2d6 + 2');
        expect(plan!.total).toBe(27);
    });

    it('computes the total from the supplied values, never re-deriving them', () => {
        const plan = planRelayedRoll([{ type: 'd20', value: 1 }], 0);
        expect(plan!.total).toBe(1);
        expect(plan!.formula).toBe('1d20');
        expect(plan!.modifier).toBe(0);
    });

    it('renders a negative modifier with a minus operator', () => {
        const plan = planRelayedRoll([{ type: 'd8', value: 4 }], -1);
        expect(plan!.formula).toBe('1d8 - 1');
        expect(plan!.total).toBe(3);
    });

    it('supports a modifier-only roll', () => {
        const plan = planRelayedRoll([], 5);
        expect(plan!.dieTerms).toEqual([]);
        expect(plan!.formula).toBe('5');
        expect(plan!.total).toBe(5);
    });

    it('returns null when there is nothing to roll', () => {
        expect(planRelayedRoll([], 0)).toBeNull();
    });

    it('skips malformed die types and non-finite values', () => {
        const plan = planRelayedRoll(
            [
                { type: 'garbage', value: 9 },
                { type: 'd12', value: Number.NaN },
                { type: 'd12', value: 11 },
            ],
            0
        );
        expect(plan!.dieTerms).toEqual([{ faces: 12, values: [11] }]);
        expect(plan!.total).toBe(11);
    });
});
