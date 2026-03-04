/**
 * Integration tests against real 2026 YouTube DOM structure.
 *
 * The fixture (subscription-feed-2026.html) is hand-crafted from a real YouTube
 * subscriptions page, anonymized and stripped of noise. It uses the actual
 * yt-lockup-view-model custom element structure that YouTube shipped in 2026.
 *
 * Key discovery: vidQuery() includes a `:has(lockup-view-model)` clause and
 * Video.js uses `querySelector("lockup-view-model")` — neither matches the real
 * `<yt-lockup-view-model>` element. This is harmless because other selectors
 * (e.g. `ytd-rich-item-renderer.style-scope.ytd-rich-grid-renderer`) match first.
 * These tests document and lock in that behavior.
 */

const fs = require('fs');
const path = require('path');
const { loadUtil, loadQueries, loadVideo, loadSubscriptionsVideo, loadSubs } = require('../helpers/load-source');

const fixtureHTML = fs.readFileSync(
    path.join(__dirname, '../fixtures/subscription-feed-2026.html'),
    'utf8'
);

describe('Real YouTube DOM - Video Detection (2026 layout)', () => {
    beforeEach(() => {
        document.body.innerHTML = fixtureHTML;
        loadUtil();
        loadQueries();
    });

    test('vidQuery() finds all non-hidden video items', () => {
        const items = document.querySelectorAll(vidQuery());
        // 2 shelf videos + 2 shorts + 4 grid videos = 8
        expect(items.length).toBe(8);
    });

    test('vidQuery() excludes items with HIDDEN_CLASS', () => {
        const items = document.querySelectorAll(vidQuery());
        items[0].classList.add(HIDDEN_CLASS);
        const remaining = document.querySelectorAll(vidQuery());
        expect(remaining.length).toBe(7);
    });

    test('finds videos in shelf renderer (ytd-rich-shelf-renderer)', () => {
        const shelfVideos = document.querySelectorAll(
            `ytd-rich-item-renderer.style-scope.ytd-rich-shelf-renderer:not(.${HIDDEN_CLASS})`
        );
        // 2 regular shelf videos + 2 shorts shelf videos = 4
        expect(shelfVideos.length).toBe(4);
    });

    test('finds videos in grid renderer (ytd-rich-grid-renderer)', () => {
        const gridVideos = document.querySelectorAll(
            `ytd-rich-item-renderer.style-scope.ytd-rich-grid-renderer:not(.${HIDDEN_CLASS})`
        );
        // Video 3 (100% watched), 6 (live), 7 (members), 8 (premiere) = 4
        expect(gridVideos.length).toBe(4);
    });

    test('lockup-view-model selector does NOT match yt-lockup-view-model', () => {
        // Documents the known selector mismatch — :has(lockup-view-model)
        // doesn't match <yt-lockup-view-model>
        const lockupQuery = `ytd-rich-item-renderer:has(lockup-view-model):not(.${HIDDEN_CLASS})`;
        const matches = document.querySelectorAll(lockupQuery);
        expect(matches.length).toBe(0);
    });
});

describe('Real YouTube DOM - Video URL & ID Extraction', () => {
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

    test('getVideoUrl() extracts /watch?v= URL from yt-lockup-view-model layout', () => {
        const items = document.querySelectorAll(vidQuery());
        // First item is the regular unwatched video (testVid_001)
        const url = getVideoUrl(items[0]);
        expect(url).toBe('/watch?v=testVid_001');
    });

    test('getVideoUrl() extracts URL with extra params', () => {
        const items = document.querySelectorAll(vidQuery());
        // Second item has t= param
        const url = getVideoUrl(items[1]);
        expect(url).toContain('/watch?v=testVid_002');
    });

    test('getVideoUrl() extracts /shorts/ URL from shorts item', () => {
        const items = document.querySelectorAll(vidQuery());
        // Shorts are items[2] and items[3] (shelf items after the 2 regular shelf videos)
        const url = getVideoUrl(items[2]);
        expect(url).toBe('/shorts/testVid_004');
    });

    test('getVideoId() returns correct ID from regular video', () => {
        const items = document.querySelectorAll(vidQuery());
        const id = getVideoId(items[0]);
        expect(id).toBe('testVid_001');
    });

    test('getVideoId() returns correct ID from short', () => {
        const items = document.querySelectorAll(vidQuery());
        const id = getVideoId(items[2]);
        expect(id).toBe('testVid_004');
    });

    test('getVideoId() returns correct ID from grid video', () => {
        const items = document.querySelectorAll(vidQuery());
        // items[4] = Video 3 (100% watched, grid)
        const id = getVideoId(items[4]);
        expect(id).toBe('testVid_003');
    });
});

describe('Real YouTube DOM - Duration & Badge Detection', () => {
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
        loadVideo();
        items = document.querySelectorAll(vidQuery());
    });

    test('getVideoDuration() extracts duration from yt-badge-shape__text', () => {
        // items[0] = Video 1 (39:36)
        const mockItem = { containingDiv: items[0] };
        const duration = getVideoDuration(mockItem);
        expect(duration).toBe('39:36');
    });

    test('getVideoDuration() extracts duration from watched video', () => {
        // items[1] = Video 2 (11:20, with progress bar)
        const mockItem = { containingDiv: items[1] };
        const duration = getVideoDuration(mockItem);
        expect(duration).toBe('11:20');
    });

    test('getVideoDuration() extracts duration from 100% watched video', () => {
        // items[4] = Video 3 (1:52, grid)
        const mockItem = { containingDiv: items[4] };
        const duration = getVideoDuration(mockItem);
        expect(duration).toBe('1:52');
    });

    test('getVideoDuration() returns null for short (no duration badge)', () => {
        // items[2] = Short 1
        const mockItem = { containingDiv: items[2] };
        const duration = getVideoDuration(mockItem);
        expect(duration).toBeNull();
    });

    test('getVideoDuration() returns null for premiere (no duration)', () => {
        // items[7] = Video 8 (premiere)
        const mockItem = { containingDiv: items[7] };
        const duration = getVideoDuration(mockItem);
        expect(duration).toBeNull();
    });

    test('isLivestream() returns true for live badge item', () => {
        // items[5] = Video 6 (livestream)
        const mockItem = { containingDiv: items[5] };
        expect(isLivestream(mockItem)).toBe(true);
    });

    test('isLivestream() returns false for regular video', () => {
        const mockItem = { containingDiv: items[0] };
        expect(isLivestream(mockItem)).toBe(false);
    });

    test('isMembersOnly() returns true for membership badge item', () => {
        // items[6] = Video 7 (members-only)
        const mockItem = { containingDiv: items[6] };
        expect(isMembersOnly(mockItem)).toBe(true);
    });

    test('isMembersOnly() returns false for regular video', () => {
        const mockItem = { containingDiv: items[0] };
        expect(isMembersOnly(mockItem)).toBe(false);
    });
});

describe('Real YouTube DOM - YouTube Watched Detection', () => {
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
        global.getCurrentPage = jest.fn(() => '/feed/subscriptions');
        global.SubscriptionVideo = jest.fn();
        global.sectionDismissableQuery = jest.fn();
        global.sectionContentsQuery = jest.fn();
        loadVideo();
        loadSubs();
        items = document.querySelectorAll(vidQuery());
    });

    test('isYouTubeWatched() detects progress bar segment class', () => {
        settings["settings.mark.watched.youtube.watched"] = true;
        // items[1] = Video 2 (has ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment)
        expect(isYouTubeWatched(items[1])).toBe(true);
    });

    test('isYouTubeWatched() detects thumbnail-overlay-progress-bar-view-model', () => {
        settings["settings.mark.watched.youtube.watched"] = true;
        // items[4] = Video 3 (100% watched, has thumbnail-overlay-progress-bar-view-model)
        expect(isYouTubeWatched(items[4])).toBe(true);
    });

    test('isYouTubeWatched() returns false for unwatched video', () => {
        settings["settings.mark.watched.youtube.watched"] = true;
        // items[0] = Video 1 (unwatched, no progress bar)
        expect(isYouTubeWatched(items[0])).toBe(false);
    });

    test('isYouTubeWatched() returns false when setting disabled', () => {
        settings["settings.mark.watched.youtube.watched"] = false;
        // Even a watched video should return false when the setting is off
        expect(isYouTubeWatched(items[1])).toBe(false);
    });
});

describe('Real YouTube DOM - Video Type Classification', () => {
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
        loadSubscriptionsVideo();
        items = document.querySelectorAll(vidQuery());
    });

    // Helper: classify a video item using the real SubscriptionVideo logic
    function classifyItem(item) {
        const video = global.createSubscriptionVideo(item);
        return {
            duration: video.videoDuration,
            live: video.isLivestream,
            members: video.isMembersOnly,
            isShort: video.isShort,
            isPremiere: video.isPremiere,
        };
    }

    test('regular video: not short, not premiere, not live, not members-only', () => {
        const props = classifyItem(items[0]); // Video 1
        expect(props.isShort).toBe(false);
        expect(props.isPremiere).toBeFalsy();
        expect(props.live).toBe(false);
        expect(props.members).toBe(false);
        expect(props.duration).toBe('39:36');
    });

    test('short: isShort is true (URL contains "shorts")', () => {
        const props = classifyItem(items[2]); // Short 1
        expect(props.isShort).toBe(true);
    });

    test('premiere: isPremiere when no duration and not live', () => {
        const props = classifyItem(items[7]); // Video 8 (premiere)
        expect(props.isPremiere).toBe(true);
        expect(props.live).toBe(false);
        expect(props.duration).toBeNull();
    });

    test('livestream: isLivestream when has live badge', () => {
        const props = classifyItem(items[5]); // Video 6 (livestream)
        expect(props.live).toBe(true);
        // Livestream has no duration but isPremiere should be false because it's live
        expect(props.isPremiere).toBeFalsy();
    });

    test('members-only: isMembersOnly when has membership badge', () => {
        const props = classifyItem(items[6]); // Video 7 (members)
        expect(props.members).toBe(true);
        // Note: getVideoDuration() uses querySelector(".yt-badge-shape__text") which
        // returns the FIRST match — the "Members only" badge text, not the duration.
        // Since "Members only" doesn't contain ":", duration is null.
        // This means members-only videos with the membership badge before the duration
        // badge will also be classified as premieres (no duration + not live).
        expect(props.duration).toBeNull();
    });
});

describe('Real YouTube DOM - Hide Logic', () => {
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

    // Helper: reload Video+SubscriptionsVideo with current global flags, then construct
    function makeVideo(item) {
        loadSubscriptionsVideo();
        return global.createSubscriptionVideo(item);
    }

    test('shouldHide: stored video hidden when hideWatched=true', () => {
        global.hideWatched = true;
        global.watchedVideos = { 'wtestVid_001': true };
        const vid = makeVideo(items[0]);
        expect(vid.shouldHide()).toBe(true);
    });

    test('shouldHide: short hidden when hideShorts=true', () => {
        global.hideShorts = true;
        const vid = makeVideo(items[2]); // Short 1
        expect(vid.shouldHide()).toBe(true);
    });

    test('shouldHide: premiere hidden when hidePremieres=true', () => {
        global.hidePremieres = true;
        const vid = makeVideo(items[7]); // Video 8 (premiere)
        expect(vid.shouldHide()).toBe(true);
    });

    test('shouldHide: livestream hidden when hideLives=true', () => {
        global.hideLives = true;
        const vid = makeVideo(items[5]); // Video 6 (livestream)
        expect(vid.shouldHide()).toBe(true);
    });

    test('shouldHide: members-only hidden when hideMembersOnly=true', () => {
        global.hideMembersOnly = true;
        const vid = makeVideo(items[6]); // Video 7 (members)
        expect(vid.shouldHide()).toBe(true);
    });

    test('shouldHide: nothing hidden when all flags off', () => {
        loadSubscriptionsVideo();
        for (let i = 0; i < items.length; i++) {
            const vid = global.createSubscriptionVideo(items[i]);
            expect(vid.shouldHide()).toBe(false);
        }
    });
});

describe('Real YouTube DOM - UI & SubscriptionVideo fallback', () => {
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
        loadVideo();
    });

    test('SubscriptionVideo contentDiv falls back to .ytd-rich-item-renderer', () => {
        loadSubscriptionsVideo();
        const items = document.querySelectorAll(vidQuery());
        const vid = global.createSubscriptionVideo(items[0]);

        // The .ytd-rich-item-renderer fallback should have matched
        expect(vid.contentDiv).not.toBeNull();
        // It should be the #content div, not the yt-lockup-view-model
        expect(vid.contentDiv.tagName).not.toBe('LOCKUP-VIEW-MODEL');
    });

    test('querySelector("lockup-view-model") does NOT match yt-lockup-view-model', () => {
        loadSubscriptionsVideo();
        const items = document.querySelectorAll(vidQuery());
        const vid = global.createSubscriptionVideo(items[0]);
        // The lockup-view-model selector doesn't match <yt-lockup-view-model>,
        // so contentDiv should NOT be a lockup-view-model element
        const lockup = items[0].querySelector("lockup-view-model");
        expect(lockup).toBeNull();
        // contentDiv was found via the .ytd-rich-item-renderer fallback instead
        expect(vid.contentDiv).not.toBeNull();
    });

    test('"Most relevant" section title exists in shelf', () => {
        const shelves = document.querySelectorAll('ytd-rich-shelf-renderer');
        const firstShelf = shelves[0];
        const title = firstShelf.querySelector('#title');
        expect(title).not.toBeNull();
        expect(title.textContent).toBe('Most relevant');
    });

    test('shorts shelf structure matches removeWatchedAndAddButton expectations', () => {
        // removeWatchedAndAddButton looks for:
        // ytd-two-column-browse-results-renderer ytd-rich-grid-renderer #contents
        // then :scope > ytd-rich-section-renderer
        // then :scope > #content > ytd-rich-shelf-renderer > #dismissible #contents
        const gridContents = document.querySelector(
            'ytd-two-column-browse-results-renderer ytd-rich-grid-renderer #contents'
        );
        expect(gridContents).not.toBeNull();

        const sections = gridContents.querySelectorAll(':scope > ytd-rich-section-renderer');
        expect(sections.length).toBe(2); // "Most relevant" + Shorts

        const shortsContents = sections[1].querySelector(
            ':scope > #content > ytd-rich-shelf-renderer > #dismissible #contents'
        );
        expect(shortsContents).not.toBeNull();
        expect(shortsContents.children.length).toBe(2); // 2 shorts
    });
});
