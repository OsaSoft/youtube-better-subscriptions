/**
 * Tests for pages/settings/settings.js saving
 */

const { loadUtil, loadSource } = require('../helpers/load-source');

describe('settings page saveSettings', () => {
    test('saves numeric selects as numbers and the others as their option value', () => {
        document.body.innerHTML = `
            <select id="settings.log.level"><option value="1">1</option><option value="3" selected>3</option></select>
            <select id="settings.stop.loading.button.style">
                <option value="text">Text</option><option value="icon" selected>Icon only</option>
            </select>
            <input type="checkbox" id="settings.hide.shorts" checked>`;
        loadUtil();
        const page = loadSource('pages/settings/settings.js', {
            log: global.log,
            logError: global.logError,
            brwsr: global.brwsr,
            DEFAULT_SETTINGS: global.DEFAULT_SETTINGS,
            SETTINGS_KEY: 'settings',
            SETTINGS_LOCAL_KEY: 'settings_cache',
        });
        page.showToast = jest.fn();

        page.saveSettings();

        const saved = brwsr._getLocalStore().settings_cache;
        expect(saved["settings.log.level"]).toBe(3);
        expect(saved["settings.stop.loading.button.style"]).toBe('icon');
        expect(saved["settings.hide.shorts"]).toBe(true);
        expect(brwsr._getSyncStore().settings).toEqual(saved);
    });
});
