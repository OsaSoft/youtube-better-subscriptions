module.exports = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverageFrom: [
        '*.js',
        'videos/*.js',
        '!jest.config.js'
    ],
    moduleFileExtensions: ['js'],
    verbose: true
};
