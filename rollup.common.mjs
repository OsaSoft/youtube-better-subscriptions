import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';
import scss from 'rollup-plugin-scss';

/** @type {import('rollup').RollupOptions} */
export default function getRollUpConfig(browser) {
    return [
        {
            input: {
                contentScript: 'contentScript/start.ts',
            },
            output: {
                dir: `dist-${browser}`,
                format: 'cjs',
                sourcemap: true,
            },
            plugins: [
                scss({
                    fileName: 'subs.css',
                    sourceMap: true,
                }),
                typescript({
                    outDir: `dist-${browser}`,
                    tsconfig: 'tsconfig.json',
                }),
                copy({
                    targets: [
                        {src: 'images', dest: `dist-${browser}`},
                        {src: 'pages', dest: `dist-${browser}`},
                        {src: 'icons', dest: `dist-${browser}`},
                        {src: `manifest.${browser}.json`, dest: `dist-${browser}`, rename: 'manifest.json'},
                    ],
                }),
            ],
        },
        {
            input: {
                serviceWorker: 'serviceWorker/index.ts',
            },
            output: {
                dir: `dist-${browser}`,
                format: 'cjs',
                sourcemap: true,
            },
            plugins: [
                typescript({
                    outDir: `dist-${browser}`,
                    tsconfig: 'tsconfig.json',
                }),
            ],
        },
        {
            input: {
                settings: 'pages/settings/settings.ts',
            },
            output: {
                dir: `dist-${browser}/pages/settings`,
                format: 'cjs',
                sourcemap: true,
            },
            plugins: [
                scss({
                    fileName: 'settings.css',
                    sourceMap: true,
                }),
                typescript({
                    outDir: `dist-${browser}/pages/settings`,
                    tsconfig: 'tsconfig.json',
                }),
            ],
        },
    ];
}
