/**
 * The extension's header controls on the subscriptions feed: the "Hide watched" toggle and label,
 * "Mark all as watched" and the settings button (the elements in addedElems).
 */

const vm = require('vm');
const { loadSource, loadUtil, loadQueries, loadSubscriptionsVideo, loadSubsUI } = require('../helpers/load-source');

const PREFIX = "osasoft-better-subscriptions_";
const CONTROL_IDS = [
    PREFIX + "hide-watched-toggle-label",
    PREFIX + "hide-watched-toggle",
    PREFIX + "subs-grid-menu-mark-all",
    PREFIX + "subs-grid-menu-settings",
];
const STOP_BUTTON = "#" + PREFIX + "stop-loading-older";
const STOP_ATTR = PREFIX + "stop-loading";

describe('header controls', () => {
    let ui;

    function setup(html) {
        document.body.innerHTML = html;
        global.isSubscriptionsPage = () => true;
        global.getCurrentPage = () => '/feed/subscriptions';
        loadUtil();
        loadQueries();
        loadSubscriptionsVideo();
        ui = loadSubsUI();
    }

    const controls = () => CONTROL_IDS.map(id => document.getElementById(id)).filter(Boolean);

    describe('when YouTube has no place for them', () => {
        test.each([true, false])('buildUI does not throw (stick right: %s)', (stickRight) => {
            settings["settings.hide.watched.ui.stick.right"] = stickRight;
            setup('<div id="page"></div>');

            expect(() => ui.buildUI()).not.toThrow();
            expect(controls()).toHaveLength(0);
            expect(vm.runInContext('addedElems', ui)).toHaveLength(0);
        });

        test('the stop-loading button is still added and works', () => {
            setup('<div id="page"></div>');
            ui.buildUI();

            const button = document.querySelector(STOP_BUTTON);
            expect(button).not.toBeNull();
            button.click();
            expect(document.documentElement.hasAttribute(STOP_ATTR)).toBe(true);
        });
    });

    test('with a place, buildUI adds all four controls there', () => {
        setup('<ytd-browse page-subtype="subscriptions"><div id="primary"></div></ytd-browse>');
        ui.buildUI();

        expect(controls()).toHaveLength(4);
        controls().forEach(control => expect(control.parentNode.tagName).toBe('YTD-BROWSE'));
    });

    describe('navigating away', () => {
        const FEED = '<ytd-browse page-subtype="subscriptions"><div id="primary">' +
            '<div class="card" style="display: none"></div></div></ytd-browse>';

        function setupFeed() {
            setup(FEED);
            const card = document.querySelector('.card');
            vm.runInContext('hidden', ui).push(card);
            ui.buildUI();
            expect(controls()).toHaveLength(4);
            expect(document.querySelector(STOP_BUTTON)).not.toBeNull();
            return card;
        }

        test('navigation start removes the header controls and the stop-loading button', () => {
            setupFeed();

            ui.removeControlsOnNavigateStart();

            expect(controls()).toHaveLength(0);
            expect(vm.runInContext('addedElems', ui)).toHaveLength(0);
            expect(document.querySelector(STOP_BUTTON)).toBeNull();
        });

        test('but leaves the hidden videos of the feed hidden', () => {
            const card = setupFeed();

            ui.removeControlsOnNavigateStart();

            expect(card.style.display).toBe('none');
        });

        test('buildUI and rebuildUI (settings synced) do not put them back before the page is unloaded', () => {
            setupFeed();
            ui.removeControlsOnNavigateStart();

            ui.buildUI();
            ui.rebuildUI();

            expect(controls()).toHaveLength(0);
            expect(document.querySelector(STOP_BUTTON)).toBeNull();
        });

        test('a stopped feed stays stopped until stopSubs, so it loads no batch meanwhile', () => {
            setupFeed();
            document.querySelector(STOP_BUTTON).click();
            expect(document.documentElement.hasAttribute(STOP_ATTR)).toBe(true);

            ui.removeControlsOnNavigateStart();
            expect(document.querySelector(STOP_BUTTON)).toBeNull();
            expect(document.documentElement.hasAttribute(STOP_ATTR)).toBe(true);

            ui.removeUI();
            expect(document.documentElement.hasAttribute(STOP_ATTR)).toBe(false);
        });

        describe('when the navigation never finishes', () => {
            test('restoring puts the controls and the stop-loading button back', () => {
                setupFeed();
                ui.removeControlsOnNavigateStart();

                ui.restoreControlsAfterAbortedNavigation();

                expect(controls()).toHaveLength(4);
                expect(document.querySelector(STOP_BUTTON)).not.toBeNull();
                // and settings syncs rebuild again
                expect(vm.runInContext('navigatingAway', ui)).toBe(false);
            });

            test('the restored button matches the kept stopped state', () => {
                setupFeed();
                document.querySelector(STOP_BUTTON).click();
                ui.removeControlsOnNavigateStart();

                ui.restoreControlsAfterAbortedNavigation();

                expect(document.documentElement.hasAttribute(STOP_ATTR)).toBe(true);
                expect(document.querySelector(STOP_BUTTON).getAttribute('data-state')).toBe('stopped');
            });

            test('builds nothing where there was nothing to take down (e.g. a video page)', () => {
                setup('<ytd-browse page-subtype="subscriptions"></ytd-browse>');
                ui.removeControlsOnNavigateStart();

                ui.restoreControlsAfterAbortedNavigation();

                expect(controls()).toHaveLength(0);
                expect(document.querySelector(STOP_BUTTON)).toBeNull();
            });

            test('does nothing once stopSubs has unloaded the page', () => {
                setupFeed();
                ui.removeControlsOnNavigateStart();
                ui.removeUI();

                ui.restoreControlsAfterAbortedNavigation();

                expect(controls()).toHaveLength(0);
            });
        });

        test('after stopSubs (removeUI) the next buildUI adds them again', () => {
            setupFeed();
            ui.removeControlsOnNavigateStart();

            ui.removeUI();
            ui.buildUI();

            expect(controls()).toHaveLength(4);
            expect(document.querySelector(STOP_BUTTON)).not.toBeNull();
        });
    });
});

describe('page handler', () => {
    let page;
    let callOrder;

    function loadPageHandler() {
        callOrder = [];
        const ctx = loadSource('pageHandler.js', {
            settingsLoadedCallbacks: [],
            settings: global.settings,
            log: () => {},
            logError: () => {},
            getCurrentPage: () => page,
            stopSubs: jest.fn(() => callOrder.push('stopSubs')),
            initSubs: jest.fn(async () => callOrder.push('initSubs')),
            onVideoPage: jest.fn(() => callOrder.push('onVideoPage')),
            onShortPage: jest.fn(),
            removeControlsOnNavigateStart: jest.fn(() => callOrder.push('removeControls')),
            restoreControlsAfterAbortedNavigation: jest.fn(() => callOrder.push('restore')),
        });
        ctx.settingsLoadedCallbacks[0]();
        return ctx;
    }

    let listeners;

    beforeEach(() => {
        jest.useFakeTimers();
        page = '/feed/subscriptions';
        // the handler's document listeners would otherwise outlive the test
        listeners = [];
        const add = document.addEventListener.bind(document);
        jest.spyOn(document, 'addEventListener').mockImplementation((type, fn, opts) => {
            listeners.push([type, fn, opts]);
            add(type, fn, opts);
        });
    });

    afterEach(() => {
        document.addEventListener.mockRestore();
        listeners.forEach(([type, fn, opts]) => document.removeEventListener(type, fn, opts));
    });

    test('removes the controls on yt-navigate-start, before the new page is handled', async () => {
        loadPageHandler();
        expect(callOrder).toEqual(['stopSubs', 'initSubs']);

        callOrder.length = 0;
        document.dispatchEvent(new Event('yt-navigate-start'));
        expect(callOrder).toEqual(['removeControls']);

        page = '/watch';
        document.dispatchEvent(new Event('yt-navigate-finish'));
        await jest.advanceTimersByTimeAsync(100);
        expect(callOrder).toEqual(['removeControls', 'stopSubs', 'onVideoPage']);
    });

    test('a navigation back to the same page rebuilds it', async () => {
        loadPageHandler();
        callOrder.length = 0;

        document.dispatchEvent(new Event('yt-navigate-start'));
        document.dispatchEvent(new Event('yt-navigate-finish'));
        await jest.advanceTimersByTimeAsync(100);

        expect(callOrder).toEqual(['removeControls', 'stopSubs', 'initSubs']);
    });

    describe('a navigation that never finishes', () => {
        test('after 5 s on the same page the controls are restored, without unloading the page', async () => {
            loadPageHandler();
            callOrder.length = 0;

            document.dispatchEvent(new Event('yt-navigate-start'));
            await jest.advanceTimersByTimeAsync(4999);
            expect(callOrder).toEqual(['removeControls']);

            await jest.advanceTimersByTimeAsync(1);
            expect(callOrder).toEqual(['removeControls', 'restore']);

            // the page counts as handled again: a late finish for it changes nothing
            document.dispatchEvent(new Event('yt-navigate-finish'));
            await jest.advanceTimersByTimeAsync(100);
            expect(callOrder).toEqual(['removeControls', 'restore']);
        });

        test('a finished navigation cancels the restore', async () => {
            loadPageHandler();
            callOrder.length = 0;

            document.dispatchEvent(new Event('yt-navigate-start'));
            page = '/watch';
            document.dispatchEvent(new Event('yt-navigate-finish'));
            await jest.advanceTimersByTimeAsync(10000);

            expect(callOrder).toEqual(['removeControls', 'stopSubs', 'onVideoPage']);
        });

        test('no restore once the page changed', async () => {
            loadPageHandler();
            callOrder.length = 0;

            document.dispatchEvent(new Event('yt-navigate-start'));
            page = '/watch';
            await jest.advanceTimersByTimeAsync(5000);

            expect(callOrder).toEqual(['removeControls']);
        });
    });
});
