/**
 * Integration tests for channel "Videos" tab DOM structure.
 *
 * The fixture (channel-videos.html) mirrors the real YouTube channel page
 * layout: ytd-rich-item-renderer > ytd-rich-grid-media > #dismissible >
 * #details > #meta > h3 > a#video-title-link > yt-formatted-string#video-title
 *
 * This layout differs from the subscriptions page — #video-title's parent
 * is NOT a direct child of #dismissible. Before the fix (#247), this caused
 * insertBefore to throw "Child to insert before is not a child of this node".
 */

const fs = require('fs');
const path = require('path');
const { loadUtil, loadQueries, loadVideo, loadSubscriptionsVideo, loadSubs } = require('../helpers/load-source');

const fixtureHTML = fs.readFileSync(
    path.join(__dirname, '../fixtures/channel-videos.html'),
    'utf8'
);

describe('Channel Page DOM - Video Detection', () => {
    beforeEach(() => {
        document.body.innerHTML = fixtureHTML;
        loadUtil();
        loadQueries();
    });

    test('vidQuery() finds all channel page video items', () => {
        const items = document.querySelectorAll(vidQuery());
        expect(items.length).toBe(4);
    });

    test('vidQuery() matches ytd-rich-item-renderer with ytd-rich-grid-renderer scope', () => {
        const items = document.querySelectorAll(vidQuery());
        for (const item of items) {
            expect(item.tagName.toLowerCase()).toBe('ytd-rich-item-renderer');
        }
    });
});

describe('Channel Page DOM - Video URL & ID Extraction', () => {
    beforeEach(() => {
        document.body.innerHTML = fixtureHTML;
        loadUtil();
        loadQueries();
        global.watchedVideos = {};
        global.buildMarkWatchedButton = jest.fn(() => document.createElement('div'));
        global.processSections = jest.fn();
        global.watchVideo = jest.fn();
        global.unwatchVideo = jest.fn();
        global.syncWatchedVideos = jest.fn();
        global.changeMarkWatchedToMarkUnwatched = jest.fn();
        loadVideo();
    });

    test('getVideoUrl() extracts /watch?v= URL from channel page video', () => {
        const items = document.querySelectorAll(vidQuery());
        const url = getVideoUrl(items[0]);
        expect(url).toBe('/watch?v=channelVid_001');
    });

    test('getVideoId() returns correct ID', () => {
        const items = document.querySelectorAll(vidQuery());
        expect(getVideoId(items[0])).toBe('channelVid_001');
        expect(getVideoId(items[1])).toBe('channelVid_002');
    });

    test('getVideoId() returns correct ID for short', () => {
        const items = document.querySelectorAll(vidQuery());
        expect(getVideoId(items[2])).toBe('channelShort_001');
    });

    test('getVideoDuration() extracts duration from channel page video', () => {
        const items = document.querySelectorAll(vidQuery());
        const mockItem = { containingDiv: items[0] };
        expect(getVideoDuration(mockItem)).toBe('15:42');
    });

    test('isLivestream() detects live badge on channel page', () => {
        const items = document.querySelectorAll(vidQuery());
        const mockItem = { containingDiv: items[3] };
        expect(isLivestream(mockItem)).toBe(true);
    });

    test('isLivestream() returns false for regular channel video', () => {
        const items = document.querySelectorAll(vidQuery());
        const mockItem = { containingDiv: items[0] };
        expect(isLivestream(mockItem)).toBe(false);
    });
});

describe('Channel Page DOM - SubscriptionVideo Construction', () => {
    let items;

    beforeEach(() => {
        document.body.innerHTML = fixtureHTML;
        loadUtil();
        loadQueries();
        global.watchedVideos = {};
        global.buildMarkWatchedButton = jest.fn(() => document.createElement('div'));
        global.processSections = jest.fn();
        global.watchVideo = jest.fn();
        global.unwatchVideo = jest.fn();
        global.syncWatchedVideos = jest.fn();
        global.changeMarkWatchedToMarkUnwatched = jest.fn();
        global.hideWatched = false;
        global.hidePremieres = false;
        global.hideShorts = false;
        global.hideLives = false;
        global.hideMembersOnly = false;
        loadSubscriptionsVideo();
        items = document.querySelectorAll(vidQuery());
    });

    test('contentDiv resolves via .ytd-rich-item-renderer class', () => {
        const vid = global.createSubscriptionVideo(items[0]);
        expect(vid.contentDiv).not.toBeNull();
        // Matches the #content div which has .ytd-rich-item-renderer from Polymer scoping
        expect(vid.contentDiv.classList.contains('ytd-rich-item-renderer')).toBe(true);
    });

    test('videoId is extracted correctly', () => {
        const vid = global.createSubscriptionVideo(items[0]);
        expect(vid.videoId).toBe('channelVid_001');
    });

    test('isShort detected from /shorts/ URL', () => {
        const vid = global.createSubscriptionVideo(items[2]);
        expect(vid.isShort).toBe(true);
    });

    test('regular video is not a short', () => {
        const vid = global.createSubscriptionVideo(items[0]);
        expect(vid.isShort).toBe(false);
    });
});

describe('Channel Page DOM - addButton() placement (#247)', () => {
    let items;

    beforeEach(() => {
        document.body.innerHTML = fixtureHTML;
        loadUtil();
        loadQueries();
        global.watchedVideos = {};
        global.buildMarkWatchedButton = jest.fn(() => document.createElement('div'));
        global.processSections = jest.fn();
        global.watchVideo = jest.fn();
        global.unwatchVideo = jest.fn();
        global.syncWatchedVideos = jest.fn();
        global.changeMarkWatchedToMarkUnwatched = jest.fn();
        global.hideWatched = false;
        global.hidePremieres = false;
        global.hideShorts = false;
        global.hideLives = false;
        global.hideMembersOnly = false;
        loadSubscriptionsVideo();
        items = document.querySelectorAll(vidQuery());
    });

    test('addButton() does not throw on channel page layout', () => {
        settings["settings.hide.mark.watched.button"] = false;
        const vid = global.createSubscriptionVideo(items[0]);
        expect(() => vid.addButton()).not.toThrow();
    });

    test('addButton() places button inside #meta area', () => {
        settings["settings.hide.mark.watched.button"] = false;
        const vid = global.createSubscriptionVideo(items[0]);
        vid.addButton();

        const meta = items[0].querySelector('#meta');
        const container = meta.querySelector('.subs-btn-container');
        expect(container).not.toBeNull();
    });

    test('addButton() does not place button above thumbnail', () => {
        settings["settings.hide.mark.watched.button"] = false;
        const vid = global.createSubscriptionVideo(items[0]);
        vid.addButton();

        const dismissible = items[0].querySelector('#dismissible');
        // First child of #dismissible should still be the thumbnail div, not the button
        expect(dismissible.firstElementChild.id).toBe('thumbnail');
    });

    test('addButton() works for all channel page video types', () => {
        settings["settings.hide.mark.watched.button"] = false;
        for (let i = 0; i < items.length; i++) {
            const vid = global.createSubscriptionVideo(items[i]);
            expect(() => vid.addButton()).not.toThrow();
        }
    });

    test('hasButton() returns true after addButton()', () => {
        settings["settings.hide.mark.watched.button"] = false;
        // Mock must return realistic structure: div#METADATA_LINE containing button#MARK_WATCHED_BTN
        global.buildMarkWatchedButton = jest.fn(() => {
            const wrapper = document.createElement('div');
            wrapper.setAttribute('id', METADATA_LINE);
            const btn = document.createElement('button');
            btn.setAttribute('id', MARK_WATCHED_BTN);
            wrapper.appendChild(btn);
            return wrapper;
        });
        loadSubscriptionsVideo();
        const vid = global.createSubscriptionVideo(items[0]);
        expect(vid.hasButton()).toBe(false);
        vid.addButton();
        expect(vid.hasButton()).toBe(true);
    });

    test('addButton() respects hide button setting', () => {
        settings["settings.hide.mark.watched.button"] = true;
        const vid = global.createSubscriptionVideo(items[0]);
        vid.addButton();

        const meta = items[0].querySelector('#meta');
        const container = meta.querySelector('.subs-btn-container');
        expect(container).toBeNull();
    });
});

describe('Channel Page DOM - YouTube Watched Detection', () => {
    let items;

    beforeEach(() => {
        document.body.innerHTML = fixtureHTML;
        loadUtil();
        loadQueries();
        global.watchedVideos = {};
        global.buildMarkWatchedButton = jest.fn(() => document.createElement('div'));
        global.processSections = jest.fn();
        global.watchVideo = jest.fn();
        global.unwatchVideo = jest.fn();
        global.syncWatchedVideos = jest.fn();
        global.changeMarkWatchedToMarkUnwatched = jest.fn();
        global.loadWatchedVideos = jest.fn();
        global.buildUI = jest.fn();
        global.removeUI = jest.fn();
        global.removeWatchedAndAddButton = jest.fn();
        global.loadMoreVideos = jest.fn();
        global.isRendered = jest.fn(() => true);
        global.getCurrentPage = jest.fn(() => '/@channel/videos');
        global.SubscriptionVideo = jest.fn();
        global.sectionDismissableQuery = jest.fn();
        global.sectionContentsQuery = jest.fn();
        loadVideo();
        loadSubs();
        items = document.querySelectorAll(vidQuery());
    });

    test('isYouTubeWatched() detects progress bar on channel page video', () => {
        settings["settings.mark.watched.youtube.watched"] = true;
        // items[1] has ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment
        expect(isYouTubeWatched(items[1])).toBe(true);
    });

    test('isYouTubeWatched() returns false for unwatched channel video', () => {
        settings["settings.mark.watched.youtube.watched"] = true;
        expect(isYouTubeWatched(items[0])).toBe(false);
    });
});

describe('Channel Page DOM - Hide Logic', () => {
    let items;

    beforeEach(() => {
        document.body.innerHTML = fixtureHTML;
        loadUtil();
        loadQueries();
        global.watchedVideos = {};
        global.buildMarkWatchedButton = jest.fn(() => document.createElement('div'));
        global.processSections = jest.fn();
        global.watchVideo = jest.fn();
        global.unwatchVideo = jest.fn();
        global.syncWatchedVideos = jest.fn();
        global.changeMarkWatchedToMarkUnwatched = jest.fn();
        global.hideWatched = false;
        global.hidePremieres = false;
        global.hideShorts = false;
        global.hideLives = false;
        global.hideMembersOnly = false;
        items = document.querySelectorAll(vidQuery());
    });

    function makeVideo(item) {
        loadSubscriptionsVideo();
        return global.createSubscriptionVideo(item);
    }

    test('shouldHide: stored video hidden when hideWatched=true', () => {
        global.hideWatched = true;
        global.watchedVideos = { 'wchannelVid_001': true };
        const vid = makeVideo(items[0]);
        expect(vid.shouldHide()).toBe(true);
    });

    test('shouldHide: short hidden when hideShorts=true', () => {
        global.hideShorts = true;
        const vid = makeVideo(items[2]);
        expect(vid.shouldHide()).toBe(true);
    });

    test('shouldHide: livestream hidden when hideLives=true', () => {
        global.hideLives = true;
        const vid = makeVideo(items[3]);
        expect(vid.shouldHide()).toBe(true);
    });
});
