import {defineConfig, loadEnv} from 'vite';
import {watchAndGenerateManifest} from "./manifest";

const path = require('path');

export default defineConfig(({mode}) => {
    // Load env file based on `mode` in the current working directory.
    const env = loadEnv(mode, process.cwd(), '')

    return {
        publicDir: path.resolve(__dirname, 'public'),
        base: '/src/',
        plugins: [
            watchAndGenerateManifest({
                outputFile: path.resolve(__dirname, (env.FOUNDRYVTT_MODULE_DIR ?? 'dist') + '/module.json')
            })
        ],
        build: {
            outDir: path.resolve(__dirname, env.FOUNDRYVTT_MODULE_DIR ?? 'dist'),
            emptyOutDir: true,
            sourcemap: mode == 'development',
            lib: {
                name: 'entry',
                entry: path.resolve(__dirname, 'src/index.ts'),
                formats: ['es'],
                fileName: 'mobivtt'
            },
            rollupOptions:{
                output:{
                    sourcemapPathTransform: (relativeSourcePath) => {
                        return relativeSourcePath.replace('../../../../../src','mobivtt-addon').replace('../../../../../node_modules','node_modules')
                    }
                }
            }
        },
        define: {
            __MOBIVTT_WEB__: JSON.stringify(env.MOBIVTT_WEB || 'https://mobivtt.com')
        },

    }
});
