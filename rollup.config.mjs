import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';
import scss from 'rollup-plugin-scss';

/** @type {import('rollup').RollupOptions} */
export default [
    {
        input: {
            contentScript: 'contentScript/start.ts',
        },
        output: {
            dir: 'dist',
            format: 'cjs',
            sourcemap: true,
        },
        plugins: [
            scss({
                fileName: 'subs.css',
                sourceMap: true,
            }),
            typescript({
                outDir: 'dist',
                tsconfig: './tsconfig.json',
            }),
            copy({
                targets: [
                    {src: 'images', dest: 'dist'},
                    {src: 'pages', dest: 'dist'},
                    {src: 'icons', dest: 'dist'},
                    {src: 'manifest.firefox.json', dest: 'dist', rename: 'manifest.json'},
                ],
            }),
        ],
    },
    {
        input: {
            serviceWorker: 'serviceWorker/index.ts',
        },
        output: {
            dir: 'dist',
            format: 'cjs',
            sourcemap: true,
        },
        plugins: [
            typescript({
                outDir: 'dist',
                tsconfig: './tsconfig.json',
            }),
        ],
    },
    {
        input: {
            settings: 'pages/settings/settings.ts',
        },
        output: {
            dir: 'dist/pages/settings',
            format: 'cjs',
            sourcemap: true,
        },
        plugins: [
            scss({
                fileName: 'settings.css',
                sourceMap: true,
            }),
            typescript({
                outDir: 'dist/pages/settings',
                tsconfig: './tsconfig.json',
            }),
        ],
    },
];
