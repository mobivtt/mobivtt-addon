// The website is the RNG authority: die values arrive already decided, so we
// reconstruct a native Foundry Roll from them WITHOUT re-rolling. Any path that
// lets Foundry evaluate the Roll itself would replace the player's result.

export interface RollPayload {
    dice: { type: string; value: number }[];
    total: number;
    modifier: number;
    flavor?: string;
}

export interface DieTermSpec {
    faces: number;
    values: number[];
}

export interface RelayedRollPlan {
    dieTerms: DieTermSpec[];
    modifier: number;
    formula: string;
    total: number;
}

function facesOf(type: string): number {
    const m = /^d(\d+)$/i.exec(type.trim());
    return m ? parseInt(m[1], 10) : NaN;
}

export function planRelayedRoll(
    dice: { type: string; value: number }[],
    modifier: number
): RelayedRollPlan | null {
    const order: number[] = [];
    const byFaces = new Map<number, number[]>();
    for (const d of dice ?? []) {
        const faces = facesOf(d.type);
        if (!Number.isFinite(faces) || faces <= 0) continue;
        if (!Number.isFinite(d.value)) continue;
        if (!byFaces.has(faces)) {
            byFaces.set(faces, []);
            order.push(faces);
        }
        byFaces.get(faces)!.push(d.value);
    }

    const mod = Number.isFinite(modifier) ? modifier : 0;
    if (order.length === 0 && mod === 0) return null;

    const dieTerms: DieTermSpec[] = order.map((faces) => ({ faces, values: byFaces.get(faces)! }));
    let diceSum = 0;
    const parts: string[] = [];
    for (const t of dieTerms) {
        parts.push(`${t.values.length}d${t.faces}`);
        for (const v of t.values) diceSum += v;
    }

    let formula = parts.join(' + ');
    if (mod !== 0) {
        if (formula) formula += mod < 0 ? ` - ${Math.abs(mod)}` : ` + ${mod}`;
        else formula = String(mod);
    }

    return { dieTerms, modifier: mod, formula, total: diceSum + mod };
}

function markEvaluated<T extends { _evaluated?: boolean }>(term: T): T {
    term._evaluated = true;
    return term;
}

export function buildFoundryRoll(plan: RelayedRollPlan): Roll {
    // v12+ namespaced term classes, with a global fallback for the full v12–v13 range.
    const terms = (foundry as any)?.dice?.terms ?? {};
    const DieCls = terms.Die ?? (globalThis as any).Die;
    const OperatorTerm = terms.OperatorTerm ?? (globalThis as any).OperatorTerm;
    const NumericTerm = terms.NumericTerm ?? (globalThis as any).NumericTerm;

    const rollTerms: any[] = [];
    let first = true;
    for (const t of plan.dieTerms) {
        if (!first) rollTerms.push(markEvaluated(new OperatorTerm({ operator: '+' })));
        first = false;
        const die = new DieCls({
            number: t.values.length,
            faces: t.faces,
            results: t.values.map((v) => ({ result: v, active: true })),
        });
        die._evaluated = true;
        rollTerms.push(die);
    }
    if (plan.modifier !== 0) {
        if (!first) rollTerms.push(markEvaluated(new OperatorTerm({ operator: plan.modifier < 0 ? '-' : '+' })));
        first = false;
        rollTerms.push(markEvaluated(new NumericTerm({ number: Math.abs(plan.modifier) })));
    }

    const roll = (Roll as any).fromTerms(rollTerms);
    // Pin evaluated so toMessage() can never fall back to a fresh random evaluate().
    (roll as any)._evaluated = true;
    return roll as Roll;
}

class RollApplicator {
    async postRoll(characterId: string, payload: RollPayload): Promise<boolean> {
        try {
            const actor = game.actors?.get(characterId);
            if (!actor) {
                console.warn(`[MobiVTT] Roll relay: actor ${characterId} not found`);
                return false;
            }
            if (!actor.isOwner) {
                console.warn(`[MobiVTT] Roll relay: no permission for ${actor.name}`);
                return false;
            }

            const plan = planRelayedRoll(payload.dice, payload.modifier);
            if (!plan) {
                console.warn('[MobiVTT] Roll relay: nothing to roll');
                return false;
            }

            const roll = buildFoundryRoll(plan);
            const speaker = ChatMessage.getSpeaker({ actor });
            const flavor = payload.flavor?.trim() || `Rolled ${plan.formula}`;
            await roll.toMessage({ speaker, flavor });
            console.log(`[MobiVTT] Relayed roll ${plan.formula} = ${plan.total} for ${actor.name}`);
            return true;
        } catch (error) {
            console.error('[MobiVTT] Failed to relay roll:', error);
            return false;
        }
    }
}

export const rollApplicator = new RollApplicator();
