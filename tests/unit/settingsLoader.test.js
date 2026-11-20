/**
 * Tests for settingsLoader.js
 * Settings loading, migration, and callback system
 */

const vm = require('vm');
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

    describe('loadSettings', () => {
        let ctx;
        let loaded;

        // settings and settingsLoadedCallbacks are top-level lets: reach them inside the context
        function load() {
            ctx = loadSettingsLoader(false);
            loaded = jest.fn();
            ctx.__loaded = loaded;
            vm.runInContext('settingsLoadedCallbacks.push(__loaded)', ctx);
            return ctx.loadSettings();
        }

        const loadedSettings = () => vm.runInContext('settings', ctx);
        const banner = () => document.querySelector('.' + PREFIX + 'settings-updated-banner');

        test('starts from the local cache, filled up with defaults', async () => {
            browser._setLocalStore({ [SETTINGS_LOCAL_KEY]: { "settings.hide.shorts": true } });
            browser._setSyncStore({ [SETTINGS_KEY]: { "settings.hide.shorts": true } });

            await load();

            expect(loadedSettings()).toEqual({ ...DEFAULT_SETTINGS, "settings.hide.shorts": true });
            expect(loaded).toHaveBeenCalledTimes(1);
            expect(vm.runInContext('settingsLoaded', ctx)).toBe(true);
            // same in sync: no banner, no rebuild
            expect(banner()).toBeNull();
            expect(global.rebuildUI).not.toHaveBeenCalled();
        });

        test('applies newer sync settings over the cache, caches them and rebuilds the UI', async () => {
            browser._setLocalStore({ [SETTINGS_LOCAL_KEY]: { "settings.hide.shorts": true } });
            browser._setSyncStore({ [SETTINGS_KEY]: { "settings.hide.shorts": false, "settings.hide.lives": true } });

            await load();

            expect(loadedSettings()["settings.hide.shorts"]).toBe(false);
            expect(loadedSettings()["settings.hide.lives"]).toBe(true);
            expect(browser._getLocalStore()[SETTINGS_LOCAL_KEY]).toEqual({ "settings.hide.shorts": false, "settings.hide.lives": true });
            expect(global.rebuildUI).toHaveBeenCalledTimes(1);
            expect(banner()).not.toBeNull();
            // callbacks ran once, from the cache
            expect(loaded).toHaveBeenCalledTimes(1);
        });

        test('migrates old log settings in the cache', async () => {
            browser._setLocalStore({ [SETTINGS_LOCAL_KEY]: { "settings.log.enabled": true, "settings.log.debug": false } });

            await load();

            expect(loadedSettings()["settings.log.level"]).toBe(3);
            expect(browser._getLocalStore()[SETTINGS_LOCAL_KEY]).toEqual({ "settings.log.level": 3 });
        });

        test('without a cache, uses sync settings and caches them', async () => {
            browser._setSyncStore({ [SETTINGS_KEY]: { "settings.hide.premieres": true } });

            await load();

            expect(loadedSettings()).toEqual({ ...DEFAULT_SETTINGS, "settings.hide.premieres": true });
            expect(browser._getLocalStore()[SETTINGS_LOCAL_KEY]).toEqual({ "settings.hide.premieres": true });
            expect(loaded).toHaveBeenCalledTimes(1);
        });

        test('without a cache or sync settings (first install), uses the defaults', async () => {
            await load();

            expect(loadedSettings()).toEqual(DEFAULT_SETTINGS);
            expect(browser._getLocalStore()[SETTINGS_LOCAL_KEY]).toBeUndefined();
            expect(loaded).toHaveBeenCalledTimes(1);
        });

        test('falls back to the defaults when sync does not answer within 2 s', async () => {
            jest.useFakeTimers();
            browser.storage.sync.get.mockImplementationOnce(() => {});

            await load();
            expect(loaded).not.toHaveBeenCalled();

            jest.advanceTimersByTime(2000);

            expect(loadedSettings()).toEqual(DEFAULT_SETTINGS);
            expect(loaded).toHaveBeenCalledTimes(1);
        });
    });
});
