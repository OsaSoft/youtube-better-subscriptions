/**
 * Periodic feed scan started by initSubs().
 *
 * YouTube renders the subscriptions feed after initSubs() has run, so the
 * one-off scan at the end of initSubs() usually finds nothing. The periodic
 * scan must add buttons to late-loaded videos regardless of hide watched.
 *
 * The feed observer (subs-observer.test.js) normally gets there first, so it is
 * stubbed out here: these tests cover the interval as the safety net.
 */

const fs = require('fs');
const path = require('path');
const { loadUtil, loadQueries, loadSubscriptionsVideo, loadSubsUI, loadSubs } = require('../helpers/load-source');

const fixtureHTML = fs.readFileSync(
    path.join(__dirname, '../fixtures/subscription-feed-2026.html'),
    'utf8'
);

const RealMutationObserver = global.MutationObserver;

describe('initSubs periodic scan', () => {
    function setup({ hideWatched, watchedVideos = {} }) {
        document.body.innerHTML = '';
        global.MutationObserver = class {
            observe() {}
            disconnect() {}
            takeRecords() { return []; }
        };
        settings["settings.hide.watched.default"] = hideWatched;
        settings["settings.hide.watched.refresh.rate"] = 3000;

        loadUtil();
        loadQueries();
        global.watchedVideos = watchedVideos;
        global.hidden = [];
        global.hideWatched = hideWatched;
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
        global.isYouTubeWatched = () => false;
        loadSubscriptionsVideo();
        // class declarations don't leak out of the VM context, so wrap the factory
        global.SubscriptionVideo = function (elem) {
            return global.createSubscriptionVideo(elem);
        };
        loadSubsUI();

        global.buildUI = jest.fn();
        global.loadMoreVideos = jest.fn();
        global.loadWatchedVideos = jest.fn().mockResolvedValue();
        return loadSubs();
    }

    afterEach(() => {
        global.stopSubs && global.stopSubs();
        global.MutationObserver = RealMutationObserver;
        jest.useRealTimers();
    });

    test('adds buttons to videos rendered after init while hide watched is off', async () => {
        jest.useFakeTimers();
        setup({ hideWatched: false });

        await initSubs();
        // feed not rendered yet: the one-off scan found nothing
        expect(document.querySelectorAll('.subs-btn-container').length).toBe(0);

        document.body.innerHTML = fixtureHTML;
        const items = [...document.querySelectorAll(vidQuery())];
        expect(items.length).toBeGreaterThan(0);

        jest.advanceTimersByTime(3000);

        for (const item of items) {
            expect(item.querySelector('#' + MARK_WATCHED_BTN)).not.toBeNull();
        }
    });

    test('keeps watched videos visible with an unwatched button while hide watched is off', async () => {
        jest.useFakeTimers();
        setup({ hideWatched: false, watchedVideos: { 'wtestVid_001': true } });

        await initSubs();
        document.body.innerHTML = fixtureHTML;
        const watchedItem = document.querySelectorAll(vidQuery())[0];

        jest.advanceTimersByTime(3000);

        expect(watchedItem.style.display).not.toBe('none');
        expect(watchedItem.querySelector('#' + MARK_UNWATCHED_BTN)).not.toBeNull();
    });

    test('replaces the button when the watched state changes elsewhere while hide watched is off', async () => {
        jest.useFakeTimers();
        const watched = {};
        setup({ hideWatched: false, watchedVideos: watched });

        await initSubs();
        document.body.innerHTML = fixtureHTML;
        const item = document.querySelectorAll(vidQuery())[0];

        jest.advanceTimersByTime(3000);
        expect(item.querySelector('#' + MARK_WATCHED_BTN)).not.toBeNull();

        // e.g. watched in another tab: storage listener updates watchedVideos, card untouched
        watched['wtestVid_001'] = true;
        jest.advanceTimersByTime(3000);

        expect(item.querySelectorAll('.subs-btn-container').length).toBe(1);
        expect(item.querySelector('#' + MARK_WATCHED_BTN)).toBeNull();
        expect(item.querySelector('#' + MARK_UNWATCHED_BTN)).not.toBeNull();
    });

    test('hides watched videos rendered after init while hide watched is on', async () => {
        jest.useFakeTimers();
        setup({ hideWatched: true, watchedVideos: { 'wtestVid_001': true } });

        await initSubs();
        document.body.innerHTML = fixtureHTML;
        const [watchedItem, unwatchedItem] = document.querySelectorAll(vidQuery());

        jest.advanceTimersByTime(3000);

        expect(watchedItem.style.display).toBe('none');
        expect(unwatchedItem.style.display).not.toBe('none');
        expect(unwatchedItem.querySelector('#' + MARK_WATCHED_BTN)).not.toBeNull();
    });
});
