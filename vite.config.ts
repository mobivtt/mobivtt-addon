import {defineConfig, loadEnv, Plugin} from 'vite';
import {watchAndGenerateManifest} from "./manifest";

const path = require('path');
const fs = require('fs');

/**
 * Vite plugin to copy build output to multiple Foundry module directories
 */
function copyToFoundryDirectories(directories: string[]): Plugin {
    return {
        name: 'copy-to-foundry-directories',
        writeBundle() {
            const distDir = path.resolve(__dirname, 'dist');

            directories.forEach(dir => {
                const targetDir = path.resolve(__dirname, dir);

                // Create a target directory if it doesn't exist
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                // Copy all files from dist to target
                const files: string[] = fs.readdirSync(distDir);
                files.forEach(file => {
                    const srcFile = path.join(distDir, file);
                    const destFile = path.join(targetDir, file);

                    if (fs.lstatSync(srcFile).isFile()) {
                        fs.copyFileSync(srcFile, destFile);
                        console.log(`Copied ${file} to ${dir}`);
                    }
                });
            });
        }
    };
}

export default defineConfig(({mode}) => {
    // Load env file based on `mode` in the current working directory.
    const env = loadEnv(mode, process.cwd(), '')

    // Determine output directories
    const foundryDirs = [];
    if (env.FOUNDRYVTT12_MODULE_DIR) {
        foundryDirs.push(env.FOUNDRYVTT12_MODULE_DIR);
    }
    if (env.FOUNDRYVTT13_MODULE_DIR) {
        foundryDirs.push(env.FOUNDRYVTT13_MODULE_DIR);
    }

    const plugins = [
        watchAndGenerateManifest({
            outputFile: path.resolve(__dirname, 'dist/module.json')
        })
    ];

    // Add copy plugin if Foundry directories are configured
    if (foundryDirs.length > 0) {
        plugins.push(copyToFoundryDirectories(foundryDirs));
        console.log(`Will copy to Foundry directories: ${foundryDirs.join(', ')}`);
    }

    return {
        publicDir: path.resolve(__dirname, 'public'),
        base: '/src/',
        plugins,
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
