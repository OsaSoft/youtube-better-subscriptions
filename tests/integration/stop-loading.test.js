/**
 * "Stop loading older videos" button on the subscriptions feed (#63).
 *
 * YouTube loads the next batch whenever its continuation element is in view. With watched videos
 * hidden it always is, so the feed loaded years of history. The button sets an attribute on <html>
 * that a subs.css rule hides the continuation element under, and remembers the choice per device.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadUtil, loadCommon, loadQueries, loadSubscriptionsVideo, loadSubsUI, loadSubs, loadSettingsLoader } = require('../helpers/load-source');

const STYLE_KEY = "settings.stop.loading.button.style";
const STATE_KEY = "subs_stop_loading_older";
const ATTR = "osasoft-better-subscriptions_stop-loading";
const BUTTON = "#osasoft-better-subscriptions_stop-loading-older";

describe('stop loading older videos', () => {
    let ui;

    function setup({ page = '/feed/subscriptions', style, stored } = {}) {
        document.body.innerHTML = '<div id="page"></div>';
        if (style !== undefined) {
            settings[STYLE_KEY] = style;
        }
        if (stored !== undefined) {
            brwsr._setLocalStore({ [STATE_KEY]: stored });
        }
        global.isSubscriptionsPage = () => page === '/feed/subscriptions';
        global.getCurrentPage = () => page;
        loadUtil();
        loadQueries();
        loadSubscriptionsVideo();
        ui = loadSubsUI();
    }

    async function show() {
        await ui.loadStopLoadingOlder();
        ui.addStopLoadingButton();
        return document.querySelector(BUTTON);
    }

    const root = () => document.documentElement;

    test('common.js defaults to the icon-and-text button', () => {
        expect(vm.runInContext('DEFAULT_SETTINGS', loadCommon())[STYLE_KEY]).toBe('icon-text');
    });

    test('shows a "Stop" button on the subscriptions feed, loading not stopped', async () => {
        setup();
        const button = await show();

        expect(button).not.toBeNull();
        expect(button.parentNode).toBe(document.body);
        expect(button.getAttribute('data-state')).toBe('loading');
        expect(button.textContent).toBe('Stop loading older videos');
        expect(root().hasAttribute(ATTR)).toBe(false);
    });

    test('clicking stops loading, remembers it, and turns the button into "Resume"', async () => {
        setup();
        const button = await show();

        button.click();

        expect(root().hasAttribute(ATTR)).toBe(true);
        expect(brwsr._getLocalStore()[STATE_KEY]).toBe(true);
        expect(button.getAttribute('data-state')).toBe('stopped');
        expect(button.textContent).toBe('Resume loading older videos');
        expect(button.getAttribute('aria-label')).toBe('Resume loading older videos');

        button.click();

        expect(root().hasAttribute(ATTR)).toBe(false);
        expect(brwsr._getLocalStore()[STATE_KEY]).toBe(false);
        expect(button.getAttribute('data-state')).toBe('loading');
        expect(button.textContent).toBe('Stop loading older videos');
    });

    test('a stored "stopped" state stops loading on the next visit', async () => {
        setup({ stored: true });
        const button = await show();

        expect(root().hasAttribute(ATTR)).toBe(true);
        expect(button.getAttribute('data-state')).toBe('stopped');
    });

    test('"off" shows no button and ignores a stored "stopped" state', async () => {
        setup({ style: 'off', stored: true });
        const button = await show();

        expect(button).toBeNull();
        expect(root().hasAttribute(ATTR)).toBe(false);
        expect(ui.isLoadingOlderStopped()).toBe(false);
    });

    test.each(['/', '/@channel/videos', '/watch'])('never appears or stops loading on %s', async (page) => {
        setup({ page, stored: true });
        const button = await show();

        expect(button).toBeNull();
        expect(root().hasAttribute(ATTR)).toBe(false);
    });

    test('removeUI (navigating away) removes the button and resumes loading', async () => {
        setup({ stored: true });
        await show();

        ui.removeUI();

        expect(document.querySelector(BUTTON)).toBeNull();
        expect(root().hasAttribute(ATTR)).toBe(false);
        // but the choice stays stored for the next visit
        expect(brwsr._getLocalStore()[STATE_KEY]).toBe(true);
    });

    test('rebuilding the UI keeps the in-memory state', async () => {
        setup();
        (await show()).click();

        ui.removeUI();
        ui.addStopLoadingButton();

        expect(root().hasAttribute(ATTR)).toBe(true);
        expect(document.querySelectorAll(BUTTON)).toHaveLength(1);
        expect(document.querySelector(BUTTON).getAttribute('data-state')).toBe('stopped');
    });

    test('follows a click in another subscriptions tab', async () => {
        setup();
        const button = await show();
        const listener = brwsr.storage.onChanged.addListener.mock.calls.map(c => c[0]).pop();

        listener({ [STATE_KEY]: { newValue: true } }, 'local');
        expect(root().hasAttribute(ATTR)).toBe(true);
        expect(button.getAttribute('data-state')).toBe('stopped');

        // other areas and keys are ignored
        listener({ [STATE_KEY]: { newValue: false } }, 'sync');
        listener({ other: { newValue: false } }, 'local');
        expect(button.getAttribute('data-state')).toBe('stopped');

        listener({ [STATE_KEY]: { newValue: false } }, 'local');
        expect(root().hasAttribute(ATTR)).toBe(false);
        expect(button.getAttribute('data-state')).toBe('loading');

        ui.removeUI();
        expect(brwsr.storage.onChanged.removeListener).toHaveBeenCalledWith(listener);
    });

    describe('button styles', () => {
        test('text: label only', async () => {
            setup({ style: 'text' });
            const button = await show();
            expect(button.querySelector('svg')).toBeNull();
            expect(button.textContent).toBe('Stop loading older videos');
        });

        test('icon-text: icon left of the label, icon changes with the state', async () => {
            setup({ style: 'icon-text' });
            const button = await show();
            expect(button.firstElementChild.tagName.toLowerCase()).toBe('svg');
            expect(button.textContent).toBe('Stop loading older videos');
            // crossed-out clock has the diagonal line
            expect(button.querySelector('path[d="M4.5 4.5l15 15"]')).not.toBeNull();

            button.click();
            // rewind clock has the arrow
            expect(button.querySelector('path[d="M3 4v4h4"]')).not.toBeNull();
            expect(button.querySelector('path[d="M4.5 4.5l15 15"]')).toBeNull();
        });

        test('icon: no text, the full label as tooltip and accessible name', async () => {
            setup({ style: 'icon' });
            const button = await show();
            expect(button.querySelector('svg')).not.toBeNull();
            expect(button.textContent).toBe('');
            expect(button.getAttribute('title')).toBe('Stop loading older videos');
            expect(button.getAttribute('aria-label')).toBe('Stop loading older videos');
            expect(button.getAttribute('data-style')).toBe('icon');
        });

        test('an unknown value falls back to the default style', async () => {
            setup({ style: 'something-old' });
            const button = await show();
            expect(button.getAttribute('data-style')).toBe('icon-text');
        });
    });

    describe('loadMoreVideos', () => {
        function setupSubs() {
            setup();
            global.loadWatchedVideos = jest.fn().mockResolvedValue();
            return loadSubs();
        }

        function addSidebar() {
            const sidebar = document.createElement('div');
            sidebar.id = 'guide-inner-content';
            let top = 0;
            const writes = [];
            Object.defineProperty(sidebar, 'scrollTop', {
                get: () => top,
                set: (v) => { writes.push(v); top = v; },
            });
            document.body.appendChild(sidebar);
            return writes;
        }

        test('nudges the sidebar to load more while loading is not stopped', () => {
            const subs = setupSubs();
            const writes = addSidebar();
            subs.loadMoreVideos();
            expect(writes.length).toBeGreaterThan(0);
        });

        test('does nothing while loading is stopped', () => {
            const subs = setupSubs();
            const writes = addSidebar();
            root().setAttribute(ATTR, '');
            subs.loadMoreVideos();
            expect(writes).toEqual([]);
        });
    });

    test('initSubs reads the stored state before building the UI and hiding videos', async () => {
        setup({ stored: true });
        const order = [];
        global.loadWatchedVideos = jest.fn().mockResolvedValue();
        global.loadStopLoadingOlder = jest.fn(async () => { order.push('load'); });
        global.buildUI = jest.fn(() => order.push('buildUI'));
        global.removeWatchedAndAddButton = jest.fn(() => order.push('scan'));
        const subs = loadSubs();

        await subs.initSubs();
        subs.stopSubs();

        expect(order.slice(0, 3)).toEqual(['load', 'buildUI', 'scan']);
    });

    test('subs.css hides the continuation element only under the attribute', () => {
        const css = fs.readFileSync(path.join(__dirname, '../../subs.css'), 'utf8');
        expect(css).toContain(
            `html[${ATTR}] ytd-browse[page-subtype="subscriptions"] ytd-rich-grid-renderer > #contents > ytd-continuation-item-renderer {\n  display: none !important;`
        );
    });
});

describe('stop-loading button style seeds', () => {
    // what the visual harness writes with --seed before the page loads
    test.each(['text', 'icon-text', 'icon', 'off'])('settings_cache + settings set the style to %s', async (style) => {
        loadUtil();
        global.DEFAULT_SETTINGS = vm.runInContext('DEFAULT_SETTINGS', loadCommon());
        brwsr._setLocalStore({ settings_cache: { [STYLE_KEY]: style } });
        brwsr._setSyncStore({ settings: { [STYLE_KEY]: style } });
        global.rebuildUI = jest.fn();
        const ctx = loadSettingsLoader(false);

        await ctx.loadSettings();

        const loaded = vm.runInContext('settings', ctx);
        expect(loaded[STYLE_KEY]).toBe(style);
        // identical local and sync settings: no "Settings synced" banner in the clip
        expect(global.rebuildUI).not.toHaveBeenCalled();
    });
});
