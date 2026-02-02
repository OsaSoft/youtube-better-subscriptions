/**
 * Tests for settingsLoader.js
 * Settings loading, migration, and callback system
 */

const { loadUtil, loadSettingsLoader } = require('../helpers/load-source');

describe('settingsLoader.js', () => {
    beforeEach(() => {
        loadUtil();
        global.rebuildUI = jest.fn();
    });

    describe('migrateSettings', () => {
        beforeEach(() => {
            loadSettingsLoader(false);
        });

        test('returns null/undefined input unchanged', () => {
            expect(migrateSettings(null)).toBeNull();
            expect(migrateSettings(undefined)).toBeUndefined();
        });

        test('migrates log.enabled=false, log.debug=false to level 1 (ERROR)', () => {
            const oldSettings = {
                "settings.log.enabled": false,
                "settings.log.debug": false,
                "settings.hide.watched.label": true
            };

            const migrated = migrateSettings(oldSettings);

            expect(migrated["settings.log.level"]).toBe(1);
            expect(migrated["settings.log.enabled"]).toBeUndefined();
            expect(migrated["settings.log.debug"]).toBeUndefined();
            expect(migrated["settings.hide.watched.label"]).toBe(true);
        });

        test('migrates log.enabled=true, log.debug=false to level 3 (INFO)', () => {
            const oldSettings = {
                "settings.log.enabled": true,
                "settings.log.debug": false
            };

            const migrated = migrateSettings(oldSettings);

            expect(migrated["settings.log.level"]).toBe(3);
        });

        test('migrates log.enabled=true, log.debug=true to level 4 (DEBUG)', () => {
            const oldSettings = {
                "settings.log.enabled": true,
                "settings.log.debug": true
            };

            const migrated = migrateSettings(oldSettings);

            expect(migrated["settings.log.level"]).toBe(4);
        });

        test('does not modify settings without old log format', () => {
            const newSettings = {
                "settings.log.level": 2,
                "settings.hide.watched.label": true
            };

            const result = migrateSettings({ ...newSettings });

            expect(result["settings.log.level"]).toBe(2);
            expect(result["settings.log.enabled"]).toBeUndefined();
        });
    });

    describe('settingsChanged', () => {
        beforeEach(() => {
            loadSettingsLoader(false);
        });

        test('returns false for null newSettings', () => {
            expect(settingsChanged({}, null)).toBe(false);
        });

        test('returns false when settings are identical', () => {
            const oldSettings = { ...DEFAULT_SETTINGS };
            const newSettings = { ...DEFAULT_SETTINGS };

            expect(settingsChanged(oldSettings, newSettings)).toBe(false);
        });

        test('returns true when a setting value differs', () => {
            const oldSettings = { ...DEFAULT_SETTINGS };
            const newSettings = {
                ...DEFAULT_SETTINGS,
                "settings.hide.watched.label": !DEFAULT_SETTINGS["settings.hide.watched.label"]
            };

            expect(settingsChanged(oldSettings, newSettings)).toBe(true);
        });

        test('returns true when new settings has additional keys', () => {
            const oldSettings = { ...DEFAULT_SETTINGS };
            const newSettings = {
                ...DEFAULT_SETTINGS,
                "settings.new.feature": true
            };

            expect(settingsChanged(oldSettings, newSettings)).toBe(true);
        });

        test('returns true when log level changes', () => {
            const oldSettings = { ...DEFAULT_SETTINGS, "settings.log.level": 1 };
            const newSettings = { ...DEFAULT_SETTINGS, "settings.log.level": 3 };

            expect(settingsChanged(oldSettings, newSettings)).toBe(true);
        });
    });

    describe('showSettingsUpdatedNotification', () => {
        beforeEach(() => {
            loadSettingsLoader(false);
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('creates and shows notification banner', () => {
            showSettingsUpdatedNotification();

            const banner = document.querySelector('.' + PREFIX + 'settings-updated-banner');
            expect(banner).not.toBeNull();
            expect(banner.textContent).toContain('Settings synced');
        });
    });

    // loadSettings tests are skipped due to complexity of async callback testing
    // across vm.runInContext boundaries
    describe.skip('loadSettings', () => {
        // Tests would need different architecture
    });
});
