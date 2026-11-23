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

describe('settings page channel exceptions', () => {
    const fs = require('fs');
    const path = require('path');
    const { loadChannelExceptionsSource } = require('../helpers/load-source');

    // the block as it is in settings.html, so the test follows its ids
    const html = fs.readFileSync(path.join(__dirname, '../../pages/settings/settings.html'), 'utf8');
    const block = html.match(/<div class="setting-item channel-exceptions"[\s\S]*?<\/form>[\s\S]*?<\/div>\s*<\/div>/)[0];

    let page;

    async function setup(exceptions) {
        document.body.innerHTML = block + '<input type="checkbox" id="settings.hide.members.only" checked>';
        brwsr._setSyncStore({ channel_exceptions: exceptions, settings: { 'settings.hide.members.only': true } });
        loadUtil();
        loadChannelExceptionsSource();
        page = loadSource('pages/settings/settings.js', {
            log: global.log,
            logError: global.logError,
            brwsr: global.brwsr,
            DEFAULT_SETTINGS: global.DEFAULT_SETTINGS,
            SETTINGS_KEY: 'settings',
            SETTINGS_LOCAL_KEY: 'settings_cache',
        });
        page.showToast = jest.fn();
        page.initChannelExceptions();
        await flush();
    }

    const flush = () => new Promise(resolve => setTimeout(resolve, 0));
    const items = () => [...document.querySelectorAll('#channel-exceptions-list li')].map(li => li.querySelector('.channel-exceptions__channel').textContent);
    const error = () => document.getElementById('channel-exceptions-error');

    async function add(value) {
        document.getElementById('channel-exceptions-input').value = value;
        document.getElementById('channel-exceptions-add').click();
        await flush();
    }

    test('shows the stored list, and an empty note when there is none', async () => {
        await setup(['@linustechtips', 'UCXuqSBlHAE6Xw-yeJA0Tunw@shortcircuit']);
        expect(items()).toEqual(['@linustechtips', '@shortcircuitUCXuqSBlHAE6Xw-yeJA0Tunw']);
        expect(document.getElementById('channel-exceptions-empty').classList.contains('hidden')).toBe(true);

        await setup(undefined);
        expect(items()).toEqual([]);
        expect(document.getElementById('channel-exceptions-empty').classList.contains('hidden')).toBe(false);
    });

    test.each([
        ['@LinusTechTips', '@linustechtips'],
        ['youtube.com/@LinusTechTips', '@linustechtips'],
        ['https://www.youtube.com/channel/UCXuqSBlHAE6Xw-yeJA0Tunw', 'UCXuqSBlHAE6Xw-yeJA0Tunw'],
    ])('adds %s and saves it at once', async (input, stored) => {
        await setup([]);
        await add(input);

        expect(brwsr._getSyncStore().channel_exceptions).toEqual([stored]);
        expect(items()).toHaveLength(1);
        expect(document.getElementById('channel-exceptions-input').value).toBe('');
        expect(error().classList.contains('hidden')).toBe(true);
    });

    test('an input that is not a channel shows an error and saves nothing', async () => {
        await setup([]);
        await add('youtube.com/c/LinusTechTips');

        expect(error().classList.contains('hidden')).toBe(false);
        expect(error().textContent).toMatch(/@handle/);
        expect(document.getElementById('channel-exceptions-input').getAttribute('aria-invalid')).toBe('true');
        expect(brwsr._getSyncStore().channel_exceptions).toEqual([]);
    });

    test('adding a channel twice keeps one entry', async () => {
        await setup(['@linustechtips']);
        await add('@LINUSTECHTIPS');

        expect(brwsr._getSyncStore().channel_exceptions).toEqual(['@linustechtips']);
        expect(page.showToast).toHaveBeenCalledWith(expect.stringMatching(/already/), 'success');
    });

    test('remove takes the channel off the list', async () => {
        await setup(['@linustechtips', '@shortcircuit']);
        document.querySelector('.channel-exceptions__remove').click();
        await flush();

        expect(brwsr._getSyncStore().channel_exceptions).toEqual(['@shortcircuit']);
        expect(items()).toEqual(['@shortcircuit']);
    });

    test('a change from a channel page shows up', async () => {
        await setup([]);
        brwsr.storage.sync.set({ channel_exceptions: ['@linustechtips'] });

        expect(items()).toEqual(['@linustechtips']);
    });

    test('Save Settings leaves the list alone', async () => {
        await setup(['@linustechtips']);
        page.saveSettings();

        expect(brwsr._getSyncStore().channel_exceptions).toEqual(['@linustechtips']);
        expect(Object.keys(brwsr._getSyncStore().settings)).toEqual(['settings.hide.members.only']);
    });
});
