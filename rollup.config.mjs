import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

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
            typescript({
                outDir: 'dist',
                tsconfig: './tsconfig.json',
            }),
            copy({
                targets: [
                    {src: '*.css', dest: 'dist'},
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
];
