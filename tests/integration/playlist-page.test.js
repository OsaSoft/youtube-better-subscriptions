/**
 * Playlist pages (/playlist?list=…, #209).
 *
 * The fixture (playlist-2026-11.html) holds two rows copied from the live page: since November 2026
 * each row is a plain div (with the gap to the next row) around a horizontal yt-lockup-view-model,
 * in yt-item-section-renderer > #contents. The eye button goes in the row's text column, under the
 * title, channel and views, clear of the ⋮ column.
 */

const fs = require('fs');
const path = require('path');
const { loadUtil, loadQueries, loadSubscriptionsVideo, loadSubsUI, loadSubs } = require('../helpers/load-source');

const playlistHTML = fs.readFileSync(
    path.join(__dirname, '../fixtures/playlist-2026-11.html'),
    'utf8'
);

const ROW_IDS = ['sOAiwNY6Blo', '071rT-6irr8'];

const rows = () => [...document.querySelectorAll('yt-item-section-renderer > #contents > div:has(> yt-lockup-view-model)')];

describe('playlist page rows', () => {
    beforeEach(() => {
        document.body.innerHTML = playlistHTML;
        loadUtil();
        loadQueries();
    });

    test('vidQuery() finds each row: the wrapper div, not the lockup, and not the continuation', () => {
        const items = [...document.querySelectorAll(vidQuery())];
        expect(items).toHaveLength(2);
        for (const item of items) {
            expect(item.tagName).toBe('DIV');
            expect(item.parentElement.id).toBe('contents');
            expect(item.firstElementChild.tagName).toBe('YT-LOCKUP-VIEW-MODEL');
        }
    });

    test('vidQuery() leaves out hidden rows; playlistVideoQuery() keeps them', () => {
        rows()[0].classList.add(HIDDEN_CLASS);
        expect(document.querySelectorAll(vidQuery())).toHaveLength(1);
        expect(document.querySelectorAll(playlistVideoQuery())).toHaveLength(2);
    });

    test('rows outside a yt-item-section-renderer are not playlist rows', () => {
        document.body.innerHTML = `<div id="contents"><div><yt-lockup-view-model></yt-lockup-view-model></div></div>`;
        expect(document.querySelectorAll(playlistVideoQuery())).toHaveLength(0);
    });
});

describe('playlist page videos', () => {
    let videoCtx;

    function setup({ hideWatched = true, watchedVideos = {}, compact = true } = {}) {
        document.body.innerHTML = playlistHTML;
        settings["settings.mark.watched.button.compact"] = compact;
        settings["settings.hide.mark.watched.button"] = false;
        loadUtil();
        loadQueries();
        global.watchedVideos = watchedVideos;
        global.hidden = [];
        global.hideWatched = hideWatched;
        global.hidePremieres = false;
        global.hideShorts = false;
        global.hideLives = false;
        global.hideMembersOnly = false;
        global.hideCollabsUnsubscribed = false;
        global.watchVideo = jest.fn();
        global.unwatchVideo = jest.fn();
        global.syncWatchedVideos = jest.fn();
        global.processSections = jest.fn();
        global.buildMarkWatchedButton = undefined;
        videoCtx = loadSubscriptionsVideo();
        loadSubsUI();
        // the real buttons, with their click handlers, for the videos and the swap after a click
        videoCtx.buildMarkWatchedButton = global.buildMarkWatchedButton;
        videoCtx.processSections = jest.fn();
    }

    afterEach(() => {
        settings["settings.mark.watched.button.compact"] = DEFAULT_SETTINGS["settings.mark.watched.button.compact"];
    });

    test('reads the video id, duration and type of each row', () => {
        setup();
        const vids = rows().map(row => createSubscriptionVideo(row));

        expect(vids.map(v => v.videoId)).toEqual(ROW_IDS);
        expect(vids[0].videoDuration).toBe('8:57');
        expect(vids[0].isShort).toBe(false);
        expect(vids[0].isPremiere).toBeUndefined();
        expect(vids[0].isLivestream).toBe(false);
        expect(vids[0].contentDiv.tagName).toBe('YT-LOCKUP-VIEW-MODEL');
    });

    test.each([true, false])('the button goes in the text column under the metadata (compact %s)', (compact) => {
        setup({ compact });
        for (const row of rows()) {
            const vid = createSubscriptionVideo(row);
            expect(vid.hasButton()).toBe(false);
            vid.addButton();

            const containers = row.querySelectorAll('.subs-btn-container');
            expect(containers).toHaveLength(1);
            const container = containers[0];
            expect(container.classList.contains('subs-btn-container--row')).toBe(true);
            expect(container.classList.contains('subs-btn-container--compact')).toBe(false);
            expect(container.parentElement.classList.contains('ytLockupMetadataViewModelTextContainer')).toBe(true);
            expect(container.previousElementSibling.classList.contains('ytLockupMetadataViewModelMetadata')).toBe(true);
            expect(container.closest('.ytLockupMetadataViewModelMenuButton')).toBeNull();
            expect(container.querySelector('#' + MARK_WATCHED_BTN)).not.toBeNull();

            expect(createSubscriptionVideo(row).hasButton()).toBe(true);
        }
    });

    test('adding the button again replaces it instead of adding a second one', () => {
        setup();
        const row = rows()[0];
        createSubscriptionVideo(row).addButton();
        createSubscriptionVideo(row).addButton();
        expect(row.querySelectorAll('.subs-btn-container')).toHaveLength(1);
    });

    test('hide watched on: marking a row watched hides the whole row', () => {
        setup({ hideWatched: true });
        const [row, other] = rows();
        createSubscriptionVideo(row).addButton();

        row.querySelector('#' + MARK_WATCHED_BTN).click();

        expect(global.watchVideo).toHaveBeenCalledWith(ROW_IDS[0]);
        expect(row.style.display).toBe('none');
        expect(row.classList.contains(HIDDEN_CLASS)).toBe(true);
        expect(other.style.display).toBe('');
        expect([...document.querySelectorAll(vidQuery())]).toEqual([other]);
    });

    test('hide watched off: a marked row stays with the WATCHED button, which unmarks it', () => {
        setup({ hideWatched: false });
        const row = rows()[0];
        const lockup = row.querySelector('yt-lockup-view-model');
        createSubscriptionVideo(row).addButton();

        row.querySelector('#' + MARK_WATCHED_BTN).click();

        expect(global.watchVideo).toHaveBeenCalledWith(ROW_IDS[0]);
        expect(row.style.display).toBe('');
        expect(row.querySelector('#' + MARK_WATCHED_BTN)).toBeNull();
        const unwatch = row.querySelector('.subs-btn-container--row #' + MARK_UNWATCHED_BTN);
        expect(unwatch).not.toBeNull();
        expect(lockup.classList.contains('semitransparent')).toBe(true);

        unwatch.click();

        expect(global.unwatchVideo).toHaveBeenCalledWith(ROW_IDS[0]);
        expect(row.querySelector('#' + MARK_UNWATCHED_BTN)).toBeNull();
        expect(row.querySelector('.subs-btn-container--row #' + MARK_WATCHED_BTN)).not.toBeNull();
        expect(lockup.classList.contains('semitransparent')).toBe(false);
    });

    test('a row stored as watched loads with the WATCHED button, faded', () => {
        setup({ hideWatched: false, watchedVideos: { ['w' + ROW_IDS[1]]: 1 } });
        const row = rows()[1];
        createSubscriptionVideo(row).addButton();

        expect(row.querySelector('.subs-btn-container--row #' + MARK_UNWATCHED_BTN)).not.toBeNull();
        expect(row.querySelector('yt-lockup-view-model').classList.contains('semitransparent')).toBe(true);
    });
});

describe('playlist page scan', () => {
    let subsCtx;

    const flushObserver = async () => {
        await Promise.resolve();
        await Promise.resolve();
    };

    function setup({ hideWatched = true, watchedVideos = {} } = {}) {
        document.body.innerHTML = '<div id="page"></div>';
        settings["settings.hide.watched.default"] = hideWatched;
        settings["settings.hide.watched.refresh.rate"] = 3000;
        settings["settings.hide.mark.watched.button"] = false;
        loadUtil();
        loadQueries();
        global.watchedVideos = watchedVideos;
        global.hidden = [];
        global.hideWatched = hideWatched;
        global.hidePremieres = false;
        global.hideShorts = false;
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
        global.isYouTubeWatched = () => false;
        loadSubscriptionsVideo();
        global.SubscriptionVideo = function (elem) {
            return global.createSubscriptionVideo(elem);
        };
        loadSubsUI();
        global.processSections = jest.fn();
        global.buildUI = jest.fn();
        global.loadMoreVideos = jest.fn();
        global.loadWatchedVideos = jest.fn().mockResolvedValue();
        subsCtx = loadSubs();
    }

    function addRows() {
        document.getElementById('page').insertAdjacentHTML('beforeend', playlistHTML);
        return rows();
    }

    beforeEach(() => jest.useFakeTimers({ doNotFake: ['queueMicrotask'] }));

    afterEach(() => {
        global.stopSubs && global.stopSubs();
        jest.useRealTimers();
        settings["settings.hide.watched.default"] = DEFAULT_SETTINGS["settings.hide.watched.default"];
    });

    test('rows YouTube renders after init get buttons before the next interval tick', async () => {
        setup({ hideWatched: false });
        await initSubs();

        const items = addRows();
        await flushObserver();

        for (const item of items) {
            expect(item.querySelectorAll('.subs-btn-container--row #' + MARK_WATCHED_BTN)).toHaveLength(1);
        }
    });

    test('hide watched on: a row stored as watched is hidden as it is rendered', async () => {
        setup({ hideWatched: true, watchedVideos: { ['w' + ROW_IDS[0]]: 1 } });
        await initSubs();

        const [watched, other] = addRows();
        await flushObserver();

        expect(watched.style.display).toBe('none');
        expect(other.style.display).toBe('');
    });

    test('older layout: a section holding the whole playlist is not taken for one video', async () => {
        setup({ hideWatched: true, watchedVideos: { wOldRow00001: 1 } });
        await initSubs();
        document.getElementById('page').innerHTML = `
            <ytd-section-list-renderer>
                <ytd-item-section-renderer class="style-scope ytd-section-list-renderer">
                    <div id="contents"><ytd-playlist-video-list-renderer>
                        <ytd-playlist-video-renderer><a id="video-title" href="/watch?v=OldRow00001&list=PLx">Old row</a></ytd-playlist-video-renderer>
                        <ytd-playlist-video-renderer><a id="video-title" href="/watch?v=OldRow00002&list=PLx">Old row</a></ytd-playlist-video-renderer>
                    </ytd-playlist-video-list-renderer></div>
                </ytd-item-section-renderer>
            </ytd-section-list-renderer>`;
        const section = document.querySelector('ytd-item-section-renderer');
        expect(document.querySelectorAll(vidQuery())).toHaveLength(1);

        await jest.advanceTimersByTimeAsync(3000);
        subsCtx.markAllAsWatched();

        expect(section.style.display).toBe('');
        expect(section.querySelector('.subs-btn-container')).toBeNull();
        expect(global.watchVideo).not.toHaveBeenCalled();
    });

    test('rows of a page left earlier (hidden ytd-browse) are left alone', async () => {
        setup({ hideWatched: true });
        await initSubs();
        document.getElementById('page').innerHTML =
            `<ytd-browse hidden>${playlistHTML}</ytd-browse><ytd-browse></ytd-browse>`;
        await flushObserver();
        await jest.advanceTimersByTimeAsync(3000);

        subsCtx.markAllAsWatched();

        expect(global.watchVideo).not.toHaveBeenCalled();
        for (const item of rows()) {
            expect(item.style.display).toBe('');
            expect(item.querySelector('.subs-btn-container')).toBeNull();
        }
    });

    test('older layout before its rows render: the list section is still not one video', async () => {
        setup({ hideWatched: true });
        global.hideShorts = true;
        await initSubs();
        document.getElementById('page').innerHTML = `
            <ytd-section-list-renderer>
                <ytd-item-section-renderer class="style-scope ytd-section-list-renderer">
                    <div id="contents"><ytd-playlist-video-list-renderer></ytd-playlist-video-list-renderer></div>
                </ytd-item-section-renderer>
            </ytd-section-list-renderer>`;
        await jest.advanceTimersByTimeAsync(3000);

        expect(document.querySelector('ytd-item-section-renderer').style.display).toBe('');
    });

    test('"Mark all as watched" marks every loaded row', async () => {
        setup({ hideWatched: true });
        await initSubs();
        const items = addRows();
        await flushObserver();

        subsCtx.markAllAsWatched();

        expect(global.watchVideo.mock.calls.map(call => call[0])).toEqual(ROW_IDS);
        for (const item of items) {
            expect(item.style.display).toBe('none');
        }
    });
});
