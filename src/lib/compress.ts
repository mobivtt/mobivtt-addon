export async function compressToBase64(input: string): Promise<string> {
    const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
    }
    return btoa(binary);
}

export async function compressJsonToBase64(value: unknown): Promise<string> {
    return compressToBase64(JSON.stringify(value));
}