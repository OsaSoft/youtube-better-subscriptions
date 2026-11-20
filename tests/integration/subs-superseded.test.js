/**
 * initSubs() awaits storage twice before it builds the UI and starts the feed scan. A navigation can
 * unload the page (stopSubs) in between; the superseded run must then stop instead of building
 * controls on the next page and starting a second interval and observer that nothing clears.
 */

const { loadUtil, loadQueries, loadSubscriptionsVideo, loadSubsUI, loadSubs } = require('../helpers/load-source');

const RealMutationObserver = global.MutationObserver;

describe('initSubs superseded by a navigation', () => {
    let observers;

    function deferred() {
        let resolve;
        const promise = new Promise(r => { resolve = r; });
        return { promise, resolve };
    }

    function setup({ watched = Promise.resolve(), stopLoading = Promise.resolve() } = {}) {
        jest.useFakeTimers();
        observers = 0;
        global.MutationObserver = class {
            constructor() { observers++; }
            observe() {}
            disconnect() {}
            takeRecords() { return []; }
        };
        loadUtil();
        loadQueries();
        loadSubscriptionsVideo();
        loadSubsUI();
        global.buildUI = jest.fn();
        global.removeUI = jest.fn();
        global.removeWatchedAndAddButton = jest.fn();
        global.loadWatchedVideos = jest.fn(() => watched);
        global.loadStopLoadingOlder = jest.fn(() => stopLoading);
        return loadSubs();
    }

    afterEach(() => {
        global.MutationObserver = RealMutationObserver;
        jest.useRealTimers();
    });

    function expectNothingStarted() {
        expect(global.buildUI).not.toHaveBeenCalled();
        expect(observers).toBe(0);
        jest.advanceTimersByTime(30000);
        expect(global.removeWatchedAndAddButton).not.toHaveBeenCalled();
    }

    test('stopped while loading watched videos: builds nothing, starts no scan', async () => {
        const watched = deferred();
        const subs = setup({ watched: watched.promise });

        const init = subs.initSubs();
        subs.stopSubs();
        watched.resolve();
        await init;

        expect(global.loadStopLoadingOlder).not.toHaveBeenCalled();
        expectNothingStarted();
    });

    test('stopped while loading the stop-loading state: builds nothing, starts no scan', async () => {
        const subs = setup();
        // the navigation unloads the page while this read is pending
        global.loadStopLoadingOlder.mockImplementation(async () => subs.stopSubs());

        await subs.initSubs();

        expect(global.loadStopLoadingOlder).toHaveBeenCalled();

        expectNothingStarted();
    });

    test('the run after it starts normally, and only once', async () => {
        const watched = deferred();
        const subs = setup({ watched: watched.promise });

        const stale = subs.initSubs();
        subs.stopSubs();
        global.loadWatchedVideos.mockImplementation(() => Promise.resolve());
        const current = subs.initSubs();
        watched.resolve();
        await Promise.all([stale, current]);

        expect(global.buildUI).toHaveBeenCalledTimes(1);
        expect(observers).toBe(1);
        global.removeWatchedAndAddButton.mockClear();
        jest.advanceTimersByTime(settings["settings.hide.watched.refresh.rate"]);
        expect(global.removeWatchedAndAddButton).toHaveBeenCalledTimes(1);

        subs.stopSubs();
    });
});
