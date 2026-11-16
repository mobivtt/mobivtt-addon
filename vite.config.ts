import {defineConfig, loadEnv} from 'vite';
import path from 'node:path';
import {watchAndGenerateManifest} from "./manifest";

const __dirname = import.meta.dirname;

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), '')

    return {
        publicDir: path.resolve(__dirname, 'public'),
        base: '/src/',
        plugins: [
            watchAndGenerateManifest({
                outputFile: path.resolve(__dirname, 'dist/module.json')
            })
        ],
        build: {
            outDir: path.resolve(__dirname, 'dist'),
            emptyOutDir: true,
            sourcemap: mode == 'development',
            lib: {
                name: 'entry',
                entry: path.resolve(__dirname, 'src/index.ts'),
                formats: ['es'],
                fileName: 'mobivtt'
            },
            rollupOptions: {
                output: {
                    sourcemapPathTransform: (relativeSourcePath: string) => {
                        return relativeSourcePath.replace('../../../../../src', 'mobivtt-addon').replace('../../../../../node_modules', 'node_modules')
                    }
                }
            }
        },
        define: {
            __MOBIVTT_WEB__: JSON.stringify(env.MOBIVTT_WEB || 'https://mobivtt.com')
        },
    }
});
