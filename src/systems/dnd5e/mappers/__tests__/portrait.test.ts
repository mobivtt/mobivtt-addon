import { describe, it, expect, vi } from 'vitest';
import { computeTargetSize, computeDownscaleSteps, encodeCanvas } from '../portrait';

describe('computeTargetSize', () => {
    it('fits within max bounds preserving aspect ratio', () => {
        expect(computeTargetSize(1000, 1000, 290, 330)).toEqual({ width: 290, height: 290 });
        expect(computeTargetSize(600, 1200, 290, 330)).toEqual({ width: 165, height: 330 });
    });

    it('never upscales', () => {
        expect(computeTargetSize(100, 120, 290, 330)).toEqual({ width: 100, height: 120 });
    });
});

describe('computeDownscaleSteps', () => {
    it('returns only the target when shrinking by less than half', () => {
        expect(computeDownscaleSteps(400, 400, 290, 290)).toEqual([{ width: 290, height: 290 }]);
    });

    it('halves progressively before the final step on large reductions', () => {
        expect(computeDownscaleSteps(2400, 2400, 290, 290)).toEqual([
            { width: 1200, height: 1200 },
            { width: 600, height: 600 },
            { width: 300, height: 300 },
            { width: 290, height: 290 },
        ]);
    });

    it('returns only the target when no resize is needed', () => {
        expect(computeDownscaleSteps(100, 100, 100, 100)).toEqual([{ width: 100, height: 100 }]);
    });
});

function fakeCanvas(webpSupported: boolean) {
    const ctx = {
        fillStyle: '',
        globalCompositeOperation: 'source-over',
        fillRect: vi.fn(),
    };
    return {
        width: 10,
        height: 10,
        ctx,
        getContext: vi.fn(() => ctx),
        toDataURL: vi.fn((type: string) => {
            if (type === 'image/webp' && webpSupported) return 'data:image/webp;base64,AAA';
            if (type === 'image/jpeg') return 'data:image/jpeg;base64,BBB';
            return 'data:image/png;base64,CCC';
        }),
    };
}

describe('encodeCanvas', () => {
    it('uses WebP (keeps transparency) when the browser can encode it', () => {
        const canvas = fakeCanvas(true);
        expect(encodeCanvas(canvas as unknown as HTMLCanvasElement)).toBe('data:image/webp;base64,AAA');
        expect(canvas.ctx.fillRect).not.toHaveBeenCalled();
    });

    it('falls back to JPEG on an opaque background instead of black', () => {
        const canvas = fakeCanvas(false);
        expect(encodeCanvas(canvas as unknown as HTMLCanvasElement)).toBe('data:image/jpeg;base64,BBB');
        expect(canvas.ctx.globalCompositeOperation).toBe('source-over');
        expect(canvas.ctx.fillRect).toHaveBeenCalledWith(0, 0, 10, 10);
    });
});
