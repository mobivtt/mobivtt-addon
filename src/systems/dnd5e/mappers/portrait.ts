// 2x the displayed size (290x330 CSS px) so portraits stay sharp on high-DPI screens
const MAX_WIDTH = 580;
const MAX_HEIGHT = 660;
const WEBP_QUALITY = 0.85;
const JPEG_QUALITY = 0.85;
const JPEG_BACKGROUND = '#ffffff';
const PLACEHOLDER_PATTERNS = ['mystery-man', 'default-avatar', 'icons/svg/'];

const cache = new Map<string, string>();

interface Size {
    width: number;
    height: number;
}

export function resolvePortraitPath(actor: any): string | null {
    const showToken = actor.flags?.dnd5e?.showTokenPortrait;
    const tokenImg = actor.prototypeToken?.texture?.src;
    const actorImg = actor.img;

    const primary = showToken && tokenImg ? tokenImg : actorImg;
    if (!primary) return null;
    if (PLACEHOLDER_PATTERNS.some(p => primary.includes(p))) return null;
    return primary;
}

export async function extractPortrait(actor: any): Promise<string | null> {
    const imgPath = resolvePortraitPath(actor);
    if (!imgPath) return null;

    if (cache.has(imgPath)) return cache.get(imgPath)!;

    try {
        const base64 = await fetchAndResize(imgPath);
        if (base64) cache.set(imgPath, base64);
        return base64;
    } catch (err) {
        console.warn('[MobiVTT] Portrait extraction failed:', err);
        return null;
    }
}

export function computeTargetSize(width: number, height: number, maxWidth: number, maxHeight: number): Size {
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Single-pass bilinear downscaling aliases badly on large reductions,
 * so halve progressively until one final step reaches the target.
 */
export function computeDownscaleSteps(srcWidth: number, srcHeight: number, dstWidth: number, dstHeight: number): Size[] {
    const steps: Size[] = [];
    let width = srcWidth;
    let height = srcHeight;
    while (width / 2 >= dstWidth && height / 2 >= dstHeight && (width / 2 > dstWidth || height / 2 > dstHeight)) {
        width = Math.round(width / 2);
        height = Math.round(height / 2);
        steps.push({ width, height });
    }
    steps.push({ width: dstWidth, height: dstHeight });
    return steps;
}

/**
 * WebP keeps transparency. Browsers that can't encode it return PNG instead,
 * in which case fall back to JPEG over an opaque background, since JPEG
 * otherwise composites transparent pixels onto black.
 */
export function encodeCanvas(canvas: HTMLCanvasElement): string {
    const webp = canvas.toDataURL('image/webp', WEBP_QUALITY);
    if (webp.startsWith('data:image/webp')) return webp;

    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = JPEG_BACKGROUND;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
    }
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function resizeImage(img: HTMLImageElement): string | null {
    const target = computeTargetSize(img.naturalWidth, img.naturalHeight, MAX_WIDTH, MAX_HEIGHT);
    let source: CanvasImageSource = img;
    let canvas: HTMLCanvasElement | null = null;

    for (const step of computeDownscaleSteps(img.naturalWidth, img.naturalHeight, target.width, target.height)) {
        const next = document.createElement('canvas');
        next.width = step.width;
        next.height = step.height;
        const ctx = next.getContext('2d');
        if (!ctx) return null;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, 0, 0, step.width, step.height);
        source = next;
        canvas = next;
    }
    return canvas ? encodeCanvas(canvas) : null;
}

async function fetchAndResize(src: string): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                resolve(resizeImage(img));
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });
}
