import type {Plugin} from 'vite';
import fs from 'fs/promises';
import path from 'path';
import manifestJson from './module.json';
import packageJson from './package.json';

export function watchAndGenerateManifest(options: {
    outputFile: string;
}): Plugin {

    async function generate() {
        try {
            manifestJson.version = packageJson.version
            manifestJson.download = `https://github.com/mobivtt/mobivtt-addon/releases/download/${packageJson.version}/module.zip`

            await fs.mkdir(path.dirname(options.outputFile), {recursive: true});
            await fs.writeFile(options.outputFile, JSON.stringify(manifestJson, null, 2), 'utf-8');
            console.log(`[plugin] Regenerated ${path.relative(process.cwd(), options.outputFile)}`);
        } catch (err) {
            console.error(`[plugin] Failed to process module.json:`, err);
        }
    }

    return {
        name: 'watch-and-generate-manifest',
        buildStart: async function () {
            this.addWatchFile('module.json');
        },
        generateBundle: async () => {
            // Called during build after Vite clears /dist and emits files
            await generate();
        },
        handleHotUpdate: async ({file}) => {
            if (path.resolve(file) === 'module.json') {
                await generate();
            }
        }
    };
}
