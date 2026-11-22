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

describe('settings page controls', () => {
    const fs = require('fs');
    const path = require('path');

    beforeEach(() => {
        const html = fs.readFileSync(path.join(__dirname, '../../pages/settings/settings.html'), 'utf8');
        document.documentElement.innerHTML = html.replace(/^<!DOCTYPE html>/i, '');
    });

    test('"Enable on playlist pages" is a toggle next to the homepage and channel page ones (#209)', () => {
        const toggle = document.getElementById('settings.hide.watched.support.playlist');
        expect(toggle.matches('input[type="checkbox"]')).toBe(true);
        const item = toggle.closest('.setting-item');
        expect(item.querySelector('.setting-title').textContent).toBe('Enable on playlist pages');
        const list = [...item.parentElement.querySelectorAll('input[type="checkbox"]')].map(input => input.id);
        expect(list).toEqual([
            'settings.hide.watched.support.channel',
            'settings.hide.watched.support.home',
            'settings.hide.watched.support.playlist',
        ]);
    });
});
