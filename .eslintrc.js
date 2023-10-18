/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    env: {
        'browser': true,
        'es6': true,
    },
    extends: [
        '@ag-media/eslint-config',
    ],
    settings: {
        'import/resolver': {
            'typescript': true,
        },
    },
    overrides: [
        {
            files: ['.eslintrc.js'],
            env: {
                'node': true,
            },
        },
    ],
    rules: {
        'unicorn/prefer-query-selector': 'off',
    },
};