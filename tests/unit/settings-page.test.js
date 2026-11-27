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

    test('saves number fields of numeric settings as numbers, empty or invalid ones as the default (#69)', () => {
        document.body.innerHTML = `
            <input type="number" id="settings.hide.duration.shorter.minutes" value="25">
            <input type="number" id="settings.hide.duration.longer.minutes" value="">
            <input type="number" id="settings.hide.watched.refresh.rate" min="100" value="5000">
            <input type="checkbox" id="settings.hide.duration.shorter" checked>`;
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
        expect(saved["settings.hide.duration.shorter.minutes"]).toBe(25);
        expect(saved["settings.hide.duration.longer.minutes"]).toBe(120);
        expect(saved["settings.hide.watched.refresh.rate"]).toBe(5000);
        expect(saved["settings.hide.duration.shorter"]).toBe(true);
    });

    test('raises a number under the field\'s min to the min', () => {
        document.body.innerHTML = `
            <input type="number" id="settings.hide.duration.shorter.minutes" min="1" value="0">
            <input type="number" id="settings.hide.duration.longer.minutes" min="1" value="-5">
            <input type="number" id="settings.hide.watched.refresh.rate" min="100" value="0">`;
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
        expect(saved["settings.hide.duration.shorter.minutes"]).toBe(1);
        expect(saved["settings.hide.duration.longer.minutes"]).toBe(1);
        expect(saved["settings.hide.watched.refresh.rate"]).toBe(100);
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

describe('settings page duration filters (#69)', () => {
    const fs = require('fs');
    const path = require('path');

    beforeEach(() => {
        const html = fs.readFileSync(path.join(__dirname, '../../pages/settings/settings.html'), 'utf8');
        document.documentElement.innerHTML = html.replace(/^<!DOCTYPE html>/i, '');
    });

    test('every default setting has an element on the page', () => {
        const missing = Object.keys(DEFAULT_SETTINGS).filter(key => !document.getElementById(key));
        expect(missing).toEqual([]);
    });

    test.each([
        ['settings.hide.duration.shorter', 'Hide videos shorter than'],
        ['settings.hide.duration.longer', 'Hide videos longer than'],
    ])('%s is a row with a switch and a minutes field at the end of Content Filters', (key, title) => {
        const toggle = document.getElementById(key);
        const minutes = document.getElementById(key + '.minutes');
        expect(toggle.matches('.toggle input[type="checkbox"]')).toBe(true);
        expect(minutes.matches('input[type="number"].input-number')).toBe(true);
        expect(minutes.getAttribute('min')).toBe('1');
        expect(minutes.getAttribute('aria-label')).toBeTruthy();
        expect(minutes.parentElement.querySelector('.input-unit').textContent).toBe('min');

        const item = toggle.closest('.setting-item');
        expect(minutes.closest('.setting-item')).toBe(item);
        expect(item.querySelector('.setting-title').textContent).toBe(title);
        expect(item.querySelector('.setting-description').textContent).not.toBe('');
        const titleId = toggle.getAttribute('aria-labelledby');
        expect(document.getElementById(titleId).textContent).toBe(title);
        expect(document.getElementById(toggle.getAttribute('aria-describedby'))).not.toBeNull();

        const group = item.closest('.settings-group');
        expect(group.querySelector('.settings-group__title').textContent).toBe('Content Filters');
        // the group's own rows, not the ones inside the collapsed Advanced filters (#70) after them
        const rows = [...group.querySelectorAll(':scope > .setting-item')];
        expect(rows.slice(-2).map(row => row.querySelector('.toggle input').id)).toEqual([
            'settings.hide.duration.shorter',
            'settings.hide.duration.longer',
        ]);
    });

    test('the channel exceptions description says the duration filters still apply', () => {
        expect(document.getElementById('channel-exceptions-desc').textContent).toMatch(/duration filters and the title patterns still apply/);
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

describe('settings page advanced filters (#70)', () => {
    const fs = require('fs');
    const path = require('path');
    const { loadCommon } = require('../helpers/load-source');

    const KEY = 'settings.hide.title.patterns';
    let page;

    function setup(patterns) {
        const html = fs.readFileSync(path.join(__dirname, '../../pages/settings/settings.html'), 'utf8');
        document.documentElement.innerHTML = html.replace(/^<!DOCTYPE html>/i, '');
        loadUtil();
        loadCommon();
        global.settings = { ...DEFAULT_SETTINGS, [KEY]: patterns };
        page = loadSource('pages/settings/settings.js', {
            log: global.log,
            logError: global.logError,
            brwsr: global.brwsr,
            settings: global.settings,
            DEFAULT_SETTINGS: global.DEFAULT_SETTINGS,
            SETTINGS_KEY: 'settings',
            SETTINGS_LOCAL_KEY: 'settings_cache',
        });
        page.showToast = jest.fn();
        page.initTitlePatterns();
        page.updateSettings();
    }

    const details = () => document.getElementById('advanced-filters');
    const status = () => document.getElementById('advanced-filters-status');
    const error = () => document.getElementById('title-patterns-error');
    const textarea = () => document.getElementById(KEY);

    function type(value) {
        textarea().value = value;
        textarea().dispatchEvent(new Event('input'));
    }

    test('is a disclosure, collapsed by default, at the end of Content Filters after the duration filters', () => {
        setup('');
        expect(details().tagName).toBe('DETAILS');
        expect(details().open).toBe(false);
        expect(details().hasAttribute('open')).toBe(false);

        const summary = details().firstElementChild;
        expect(summary.tagName).toBe('SUMMARY');
        expect(summary.textContent).toContain('Advanced filters');

        const group = details().closest('.settings-group');
        expect(group.querySelector('.settings-group__title').textContent).toBe('Content Filters');
        expect(group.lastElementChild).toBe(details());
        expect(details().previousElementSibling.querySelector('.toggle input').id).toBe('settings.hide.duration.longer');
    });

    test('the pattern field lives inside it, labelled and described', () => {
        setup('');
        expect(textarea().tagName).toBe('TEXTAREA');
        expect(details().contains(textarea())).toBe(true);
        expect(document.querySelector(`label[for="${KEY}"]`).textContent).toBe('Hide videos by title');
        const describedBy = textarea().getAttribute('aria-describedby').split(' ');
        expect(describedBy).toEqual(['setting-hide-title-patterns-desc', 'title-patterns-error']);
        expect(document.getElementById('setting-hide-title-patterns-desc').textContent).toMatch(/one pattern per line/i);
    });

    test('clicking the summary opens and closes it', () => {
        setup('');
        const summary = details().querySelector('summary');
        summary.click();
        expect(details().open).toBe(true);
        summary.click();
        expect(details().open).toBe(false);
    });

    test('without patterns the summary shows no count', () => {
        setup('');
        expect(status().classList.contains('hidden')).toBe(true);
        expect(status().textContent).toBe('');
        expect(error().classList.contains('hidden')).toBe(true);
    });

    test('saved patterns show their count in the summary while collapsed', () => {
        setup('doomsday\n\ngta (6|vi)\n');
        expect(details().open).toBe(false);
        expect(textarea().value).toBe('doomsday\n\ngta (6|vi)\n');
        expect(status().classList.contains('hidden')).toBe(false);
        expect(status().textContent).toBe('2 title patterns');
    });

    test('one pattern is singular', () => {
        setup('trailer');
        expect(status().textContent).toBe('1 title pattern');
    });

    test('the count follows typing', () => {
        setup('');
        type('a\nb\nc');
        expect(status().textContent).toBe('3 title patterns');
        type('  \n');
        expect(status().classList.contains('hidden')).toBe(true);
    });

    test('an invalid line shows an inline error naming it, marks the field invalid, and the rest still count', () => {
        setup('');
        type('doomsday\n(unclosed\ngta');
        expect(status().textContent).toBe('2 title patterns · 1 invalid');
        expect(error().classList.contains('hidden')).toBe(false);
        expect(error().textContent).toMatch(/^Line 2 is not a valid pattern and is skipped \(.+\)$/);
        expect(error().textContent).not.toMatch(/Invalid regular expression|\/i:/);
        expect(textarea().getAttribute('aria-invalid')).toBe('true');

        type('doomsday\ngta');
        expect(error().classList.contains('hidden')).toBe(true);
        expect(textarea().hasAttribute('aria-invalid')).toBe(false);
    });

    test('invalid lines are saved anyway, as typed (they are skipped where videos are hidden)', () => {
        setup('');
        type('doomsday\n(unclosed');
        page.saveSettings();
        expect(brwsr._getLocalStore().settings_cache[KEY]).toBe('doomsday\n(unclosed');
        expect(brwsr._getSyncStore().settings[KEY]).toBe('doomsday\n(unclosed');
    });

    test('text over the cap shows an error and is not saved', () => {
        setup('');
        brwsr._setLocalStore({});
        brwsr._setSyncStore({});
        const tooLong = 'x'.repeat(MAX_TITLE_PATTERNS_BYTES);
        type(tooLong);
        expect(error().textContent).toMatch(/^Too long to save: \d+ of 1024 bytes/);
        expect(textarea().getAttribute('aria-invalid')).toBe('true');

        page.saveSettings();

        expect(page.showToast).toHaveBeenCalledWith('Title patterns are too long to save', 'error');
        expect(brwsr._getLocalStore().settings_cache).toBeUndefined();
        expect(brwsr._getSyncStore().settings).toBeUndefined();
        expect(details().open).toBe(true);
    });

    test('text at the cap saves', () => {
        setup('');
        type('x'.repeat(MAX_TITLE_PATTERNS_BYTES - 2)); // + the JSON quotes
        page.saveSettings();
        expect(brwsr._getLocalStore().settings_cache[KEY]).toHaveLength(MAX_TITLE_PATTERNS_BYTES - 2);
    });

    test('the settings item stays well under sync storage\'s per-item limit with patterns at their cap', () => {
        const full = { ...DEFAULT_SETTINGS, [KEY]: 'x'.repeat(MAX_TITLE_PATTERNS_BYTES - 2) };
        expect(syncItemBytes('settings', full)).toBeLessThan(8192 / 2);
    });
});
