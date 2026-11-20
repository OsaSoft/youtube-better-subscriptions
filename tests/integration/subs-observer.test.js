/**
 * Feed observer started by initSubs().
 *
 * YouTube renders the feed after initSubs() and keeps adding cards on scroll. The observer handles
 * each card in the microtask after YouTube inserts it, before the browser paints, so buttons don't
 * pop in seconds later and (with the compact button off) rows don't jump when they land. Timers are
 * faked and never advanced: anything that happens here is the observer's doing, not the interval's.
 */

const fs = require('fs');
const path = require('path');
const { loadUtil, loadQueries, loadSubscriptionsVideo, loadSubsUI, loadSubs } = require('../helpers/load-source');

const camelHTML = fs.readFileSync(
    path.join(__dirname, '../fixtures/subscription-feed-2026-11-camel.html'),
    'utf8'
);
const channelHTML = fs.readFileSync(
    path.join(__dirname, '../fixtures/channel-videos.html'),
    'utf8'
);

// lets the MutationObserver callback run, without touching (fake) timers
const flushObserver = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('initSubs feed observer', () => {
    let realProcessRenderedVideo;

    function setup({ hideWatched = false, watchedVideos = {}, compact = false, hideShorts = false, hidePremieres = false, isYouTubeWatched = () => false } = {}) {
        document.body.innerHTML = '<div id="page"></div>';
        settings["settings.hide.watched.default"] = hideWatched;
        settings["settings.hide.watched.refresh.rate"] = 3000;
        settings["settings.mark.watched.button.compact"] = compact;
        settings["settings.hide.mark.watched.button"] = false;

        loadUtil();
        loadQueries();
        global.watchedVideos = watchedVideos;
        global.hidden = [];
        global.hideWatched = hideWatched;
        global.hideShorts = hideShorts;
        global.hidePremieres = hidePremieres;
        global.hideLives = false;
        global.hideMembersOnly = false;
        global.hideCollabsUnsubscribed = false;
        global.watchVideo = jest.fn();
        global.unwatchVideo = jest.fn();
        global.syncWatchedVideos = jest.fn();
        global.processSections = jest.fn();
        global.buildMarkWatchedButton = jest.fn((container, item, videoId, isMarkWatchedBtn = true) => {
            const line = document.createElement('div');
            line.setAttribute('id', METADATA_LINE);
            const button = document.createElement('button');
            button.setAttribute('id', isMarkWatchedBtn ? MARK_WATCHED_BTN : MARK_UNWATCHED_BTN);
            line.appendChild(button);
            return line;
        });
        global.isYouTubeWatched = isYouTubeWatched;
        loadSubscriptionsVideo();
        global.SubscriptionVideo = function (elem) {
            return global.createSubscriptionVideo(elem);
        };
        loadSubsUI();

        realProcessRenderedVideo = global.processRenderedVideo;
        global.processRenderedVideo = jest.fn(item => realProcessRenderedVideo(item));
        const realScan = global.removeWatchedAndAddButton;
        global.removeWatchedAndAddButton = jest.fn(() => realScan());
        global.processSections = jest.fn();
        global.buildUI = jest.fn();
        global.loadMoreVideos = jest.fn();
        global.loadWatchedVideos = jest.fn().mockResolvedValue();
        return loadSubs();
    }

    function addFeed(html) {
        document.getElementById('page').insertAdjacentHTML('beforeend', html);
        return [...document.querySelectorAll(vidQuery())];
    }

    // microtasks stay real: the observer callback is one
    beforeEach(() => jest.useFakeTimers({ doNotFake: ['queueMicrotask'] }));

    afterEach(() => {
        global.stopSubs && global.stopSubs();
        jest.useRealTimers();
    });

    test('cards rendered after init get buttons before the next interval tick', async () => {
        setup();
        await initSubs();

        const items = addFeed(camelHTML);
        expect(items.length).toBe(3);
        await flushObserver();

        for (const item of items) {
            expect(item.querySelector('#' + MARK_WATCHED_BTN)).not.toBeNull();
            expect(item.querySelector('.subs-btn-container--bottom')).not.toBeNull();
        }
    });

    test('compact on: the button goes under the menu button', async () => {
        setup({ compact: true });
        await initSubs();

        const items = addFeed(camelHTML);
        await flushObserver();

        for (const item of items) {
            const container = item.querySelector('.subs-btn-container');
            expect(container.classList.contains('subs-btn-container--compact')).toBe(true);
            expect(container.closest('.ytLockupMetadataViewModelMenuButton')).not.toBeNull();
        }
    });

    test('scroll-loaded cards get buttons too', async () => {
        setup();
        await initSubs();

        addFeed(camelHTML);
        await flushObserver();

        // a second batch, appended to the existing grid like YouTube's continuation
        const grid = document.querySelector('ytd-rich-grid-renderer #contents');
        const tmp = document.createElement('div');
        tmp.innerHTML = camelHTML;
        const more = [...tmp.querySelectorAll('ytd-rich-item-renderer')];
        more.forEach(card => grid.appendChild(card));
        await flushObserver();

        for (const card of more) {
            expect(card.querySelectorAll('.subs-btn-container').length).toBe(1);
        }
    });

    test('a card whose content arrives after the card waits for it and is not hidden by mistake', async () => {
        setup({ hideShorts: true, hidePremieres: true });
        await initSubs();

        const tmp = document.createElement('div');
        tmp.innerHTML = camelHTML;
        const card = tmp.querySelector('ytd-rich-item-renderer');
        const lockup = card.querySelector('yt-lockup-view-model');
        lockup.remove();

        // the empty shell: no link, no badges. Judged now it would look like a short/premiere
        addFeed('<ytd-rich-grid-renderer class="style-scope ytd-two-column-browse-results-renderer"><div id="contents" class="style-scope ytd-rich-grid-renderer"></div></ytd-rich-grid-renderer>');
        document.querySelector('#contents').appendChild(card);
        await flushObserver();

        expect(card.style.display).not.toBe('none');
        expect(card.querySelector('.subs-btn-container')).toBeNull();

        // YouTube fills in the lockup
        card.querySelector('#content').appendChild(lockup);
        await flushObserver();

        expect(card.style.display).not.toBe('none');
        expect(card.querySelectorAll('.subs-btn-container').length).toBe(1);
        expect(card.querySelector('.subs-btn-container--bottom')).not.toBeNull();
    });

    test('an empty lockup is not given a button until YouTube builds its contents', async () => {
        setup();
        await initSubs();

        const tmp = document.createElement('div');
        tmp.innerHTML = camelHTML;
        const card = tmp.querySelector('ytd-rich-item-renderer');
        const lockup = card.querySelector('yt-lockup-view-model');
        const host = lockup.firstElementChild;
        host.remove();

        addFeed('<ytd-rich-grid-renderer class="style-scope ytd-two-column-browse-results-renderer"><div id="contents" class="style-scope ytd-rich-grid-renderer"></div></ytd-rich-grid-renderer>');
        document.querySelector('#contents').appendChild(card);
        await flushObserver();

        // judged now, the button would land inside the empty lockup and stay there
        expect(card.querySelector('.subs-btn-container')).toBeNull();

        lockup.appendChild(host);
        await flushObserver();

        expect(card.querySelectorAll('.subs-btn-container').length).toBe(1);
        const container = card.querySelector('.subs-btn-container');
        expect(container.classList.contains('subs-btn-container--bottom')).toBe(true);
        expect(container.previousElementSibling).toBe(host);
    });

    test('hide watched on: a watched card is hidden as it is rendered', async () => {
        setup({ hideWatched: true, watchedVideos: { wtestCam_001: true } });
        await initSubs();

        const [watched, unwatched] = addFeed(camelHTML);
        await flushObserver();

        expect(watched.style.display).toBe('none');
        expect(watched.querySelector('#' + MARK_UNWATCHED_BTN)).not.toBeNull();
        expect(unwatched.style.display).not.toBe('none');
        expect(unwatched.querySelector('#' + MARK_WATCHED_BTN)).not.toBeNull();

        // sections/loading more are coalesced into the next frame
        expect(global.processSections).not.toHaveBeenCalled();
        jest.advanceTimersByTime(16);
        expect(global.processSections).toHaveBeenCalledTimes(1);
    });

    test('several bursts hiding cards in one frame update sections once', async () => {
        setup({ hideWatched: true, watchedVideos: { wtestCam_001: true, wtestCam_003: true } });
        await initSubs();

        const tmp = document.createElement('div');
        tmp.innerHTML = camelHTML;
        const cards = [...tmp.querySelectorAll('ytd-rich-item-renderer')];
        addFeed('<ytd-rich-grid-renderer class="style-scope ytd-two-column-browse-results-renderer"><div id="contents" class="style-scope ytd-rich-grid-renderer"></div></ytd-rich-grid-renderer>');
        const grid = document.querySelector('#contents');
        grid.appendChild(cards[0]);
        await flushObserver();
        grid.appendChild(cards[1]);
        await flushObserver();

        expect(cards[0].style.display).toBe('none');
        expect(cards[1].style.display).toBe('none');
        jest.advanceTimersByTime(16);
        expect(global.processSections).toHaveBeenCalledTimes(1);
    });

    test('compact on: a ⋮ built after the rest of the card still gets the button under it', async () => {
        setup({ compact: true });
        await initSubs();

        const tmp = document.createElement('div');
        tmp.innerHTML = camelHTML;
        const card = tmp.querySelector('ytd-rich-item-renderer');
        const menu = card.querySelector('.ytLockupMetadataViewModelMenuButton');
        const metadataHost = menu.parentElement;
        menu.remove();

        addFeed('<ytd-rich-grid-renderer class="style-scope ytd-two-column-browse-results-renderer"><div id="contents" class="style-scope ytd-rich-grid-renderer"></div></ytd-rich-grid-renderer>');
        document.querySelector('#contents').appendChild(card);
        await flushObserver();

        // link and metadata are there, the ⋮ isn't: no bottom-row fallback
        expect(card.querySelector('.subs-btn-container')).toBeNull();

        metadataHost.appendChild(menu);
        await flushObserver();

        expect(card.querySelectorAll('.subs-btn-container').length).toBe(1);
        expect(card.querySelector('.subs-btn-container--bottom')).toBeNull();
        expect(card.querySelector('.subs-btn-container').closest('.ytLockupMetadataViewModelMenuButton')).not.toBeNull();
    });

    test('compact on: a bottom-row button the interval placed before the ⋮ existed moves under it', async () => {
        setup({ compact: true });
        await initSubs();

        const tmp = document.createElement('div');
        tmp.innerHTML = camelHTML;
        const card = tmp.querySelector('ytd-rich-item-renderer');
        const menu = card.querySelector('.ytLockupMetadataViewModelMenuButton');
        const metadataHost = menu.parentElement;
        menu.remove();

        addFeed('<ytd-rich-grid-renderer class="style-scope ytd-two-column-browse-results-renderer"><div id="contents" class="style-scope ytd-rich-grid-renderer"></div></ytd-rich-grid-renderer>');
        document.querySelector('#contents').appendChild(card);
        await flushObserver();

        // the periodic scan doesn't wait for the ⋮ and falls back to the bottom row
        removeWatchedAndAddButton();
        await flushObserver();
        expect(card.querySelector('.subs-btn-container--bottom')).not.toBeNull();

        // ⋮ arrives: the observer moves the button (the interval would too, via hasButton())
        metadataHost.appendChild(menu);
        await flushObserver();

        expect(card.querySelectorAll('.subs-btn-container').length).toBe(1);
        expect(card.querySelector('.subs-btn-container--bottom')).toBeNull();
        expect(card.querySelector('.subs-btn-container--compact')).not.toBeNull();
    });

    test('a progress-bar-watched card without a duration badge is not hidden as a premiere', async () => {
        setup({
            hidePremieres: true,
            isYouTubeWatched: item => item.querySelector('thumbnail-overlay-progress-bar-view-model') != null
        });
        await initSubs();

        const tmp = document.createElement('div');
        tmp.innerHTML = camelHTML;
        const card = tmp.querySelector('ytd-rich-item-renderer');
        card.querySelector('yt-thumbnail-badge-view-model').remove();
        card.querySelector('yt-thumbnail-view-model').appendChild(document.createElement('thumbnail-overlay-progress-bar-view-model'));
        addFeed('<ytd-rich-grid-renderer class="style-scope ytd-two-column-browse-results-renderer"><div id="contents" class="style-scope ytd-rich-grid-renderer"></div></ytd-rich-grid-renderer>');
        document.querySelector('#contents').appendChild(card);
        await flushObserver();

        expect(global.watchVideo).toHaveBeenCalledWith('testCam_001');
        expect(card.style.display).not.toBe('none');
        expect(card.querySelectorAll('.subs-btn-container').length).toBe(1);
        expect(card.querySelector('#' + MARK_UNWATCHED_BTN)).not.toBeNull();
    });

    test('hide watched on: a card YouTube shows as watched is marked and hidden as it is rendered', async () => {
        setup({
            hideWatched: true,
            isYouTubeWatched: item => item.querySelector('thumbnail-overlay-progress-bar-view-model') != null
        });
        await initSubs();

        const tmp = document.createElement('div');
        tmp.innerHTML = camelHTML;
        tmp.querySelector('yt-thumbnail-view-model').appendChild(document.createElement('thumbnail-overlay-progress-bar-view-model'));
        addFeed(tmp.innerHTML);
        const [watched, unwatched] = document.querySelectorAll('ytd-rich-item-renderer');
        await flushObserver();

        expect(global.watchVideo).toHaveBeenCalledWith('testCam_001');
        expect(global.watchVideo).toHaveBeenCalledTimes(1);
        expect(watched.style.display).toBe('none');
        expect(watched.querySelector('#' + MARK_UNWATCHED_BTN)).not.toBeNull();
        expect(unwatched.style.display).not.toBe('none');
    });

    test('hide watched off: a watched card stays with an unwatched button', async () => {
        setup({ watchedVideos: { wtestCam_001: true } });
        await initSubs();

        const [watched] = addFeed(camelHTML);
        await flushObserver();

        expect(watched.style.display).not.toBe('none');
        expect(watched.querySelector('#' + MARK_UNWATCHED_BTN)).not.toBeNull();
    });

    test('mutations outside feed cards do not trigger any scan', async () => {
        setup();
        await initSubs();
        global.removeWatchedAndAddButton.mockClear();

        const div = document.createElement('div');
        div.innerHTML = '<span>tooltip</span><ytd-video-preview><div></div></ytd-video-preview>';
        document.body.appendChild(div);
        await flushObserver();

        expect(global.processRenderedVideo).not.toHaveBeenCalled();
        expect(global.removeWatchedAndAddButton).not.toHaveBeenCalled();
    });

    test('its own insertions do not feed back into the observer', async () => {
        setup({ compact: true });
        await initSubs();

        const items = addFeed(camelHTML);
        await flushObserver();
        const calls = global.processRenderedVideo.mock.calls.length;
        expect(calls).toBe(items.length);

        await flushObserver();
        await flushObserver();
        expect(global.processRenderedVideo.mock.calls.length).toBe(calls);
    });

    test('channel page cards (old layout) get buttons', async () => {
        setup();
        await initSubs();

        const items = addFeed(channelHTML);
        expect(items.length).toBe(4);
        await flushObserver();

        for (const item of items) {
            expect(item.querySelectorAll('.subs-btn-container').length).toBe(1);
        }
    });

    test('stopSubs() disconnects the observer', async () => {
        setup();
        await initSubs();
        stopSubs();

        const items = addFeed(camelHTML);
        await flushObserver();

        for (const item of items) {
            expect(item.querySelector('.subs-btn-container')).toBeNull();
        }
    });

    test('initSubs() twice does not stack observers', async () => {
        setup();
        await initSubs();
        await initSubs();

        const items = addFeed(camelHTML);
        await flushObserver();

        expect(global.processRenderedVideo.mock.calls.length).toBe(items.length);
    });
});
