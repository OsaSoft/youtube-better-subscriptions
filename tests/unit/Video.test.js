/**
 * Tests for videos/Video.js
 * Video detection logic - helper functions
 */

const { loadUtil, loadVideo } = require('../helpers/load-source');

describe('Video.js', () => {
    let videoContext;

    beforeEach(() => {
        // Load dependencies
        loadUtil();

        // Set up globals that Video.js depends on
        global.METADATA_LINE = PREFIX + "metadata-line";
        global.MARK_WATCHED_BTN = PREFIX + "mark-watched";
        global.MARK_UNWATCHED_BTN = PREFIX + "mark-unwatched";
        global.HIDDEN_CLASS = PREFIX + "hidden";

        // Mock functions
        global.watchVideo = jest.fn();
        global.unwatchVideo = jest.fn();
        global.syncWatchedVideos = jest.fn();
        global.processSections = jest.fn();
        global.buildMarkWatchedButton = jest.fn(() => document.createElement('div'));
        global.hidden = [];
        global.hideWatched = false;
        global.hidePremieres = false;
        global.hideShorts = false;
        global.hideLives = false;
        global.hideMembersOnly = false;

        // Load Video.js
        videoContext = loadVideo();
    });

    describe('getVideoIdFromUrl', () => {
        test('extracts video ID from standard watch URL', () => {
            const id = getVideoIdFromUrl('/watch?v=dQw4w9WgXcQ');
            expect(id).toBe('dQw4w9WgXcQ');
        });

        test('extracts video ID from URL with extra parameters', () => {
            const id = getVideoIdFromUrl('/watch?v=dQw4w9WgXcQ&t=120&list=PLtest');
            expect(id).toBe('dQw4w9WgXcQ');
        });

        test('extracts video ID from shorts URL', () => {
            const id = getVideoIdFromUrl('/shorts/abcdefghijk');
            expect(id).toBe('abcdefghijk');
        });

        test('returns null for malformed URL', () => {
            const id = getVideoIdFromUrl('/invalid');
            expect(id).toBeNull();
        });

        test('returns null for URL without video ID', () => {
            const id = getVideoIdFromUrl('/watch');
            expect(id).toBeNull();
        });
    });

    describe('getVideoUrl', () => {
        test('gets URL from old layout video-title element', () => {
            document.body.innerHTML = `
                <div id="container">
                    <a id="video-title" href="/watch?v=test1234567">Title</a>
                </div>
            `;
            const container = document.getElementById('container');

            const url = getVideoUrl(container);

            expect(url).toBe('/watch?v=test1234567');
        });

        test('gets URL from new lockupViewModel layout', () => {
            document.body.innerHTML = `
                <div id="container">
                    <lockup-view-model>
                        <a href="/watch?v=newLayout11">Title</a>
                    </lockup-view-model>
                </div>
            `;
            const container = document.getElementById('container');

            const url = getVideoUrl(container);

            expect(url).toBe('/watch?v=newLayout11');
        });

        test('falls back to any link when specific selectors fail', () => {
            document.body.innerHTML = `
                <div id="container">
                    <a href="/watch?v=fallback111">Title</a>
                </div>
            `;
            const container = document.getElementById('container');

            const url = getVideoUrl(container);

            expect(url).toBe('/watch?v=fallback111');
        });

        test('returns null when no link found', () => {
            document.body.innerHTML = `<div id="container"><span>No link</span></div>`;
            const container = document.getElementById('container');

            const url = getVideoUrl(container);

            expect(url).toBeNull();
        });

        test('returns null when link has no href', () => {
            document.body.innerHTML = `
                <div id="container">
                    <a id="video-title">No href</a>
                </div>
            `;
            const container = document.getElementById('container');

            const url = getVideoUrl(container);

            expect(url).toBeNull();
        });
    });

    describe('getVideoId', () => {
        test('returns video ID from container', () => {
            document.body.innerHTML = `
                <div id="container">
                    <a id="video-title" href="/watch?v=dQw4w9WgXcQ">Title</a>
                </div>
            `;
            const container = document.getElementById('container');

            const id = getVideoId(container);

            expect(id).toBe('dQw4w9WgXcQ');
        });

        test('returns null when no URL found', () => {
            document.body.innerHTML = `<div id="container"></div>`;
            const container = document.getElementById('container');

            const id = getVideoId(container);

            expect(id).toBeNull();
        });
    });

    describe('getVideoDuration', () => {
        test('gets duration from old layout badge', () => {
            document.body.innerHTML = `
                <div id="container">
                    <div class="yt-badge-shape__text">10:30</div>
                </div>
            `;
            const video = { containingDiv: document.getElementById('container') };

            const duration = getVideoDuration(video);

            expect(duration).toBe('10:30');
        });

        test('gets duration from new lockupViewModel layout', () => {
            document.body.innerHTML = `
                <div id="container">
                    <lockup-view-model>
                        <thumbnail-badge-view-model>12:45</thumbnail-badge-view-model>
                    </lockup-view-model>
                </div>
            `;
            const video = { containingDiv: document.getElementById('container') };

            const duration = getVideoDuration(video);

            expect(duration).toBe('12:45');
        });

        test('returns null when no duration badge found', () => {
            document.body.innerHTML = `<div id="container"></div>`;
            const video = { containingDiv: document.getElementById('container') };

            const duration = getVideoDuration(video);

            expect(duration).toBeNull();
        });

        test('returns null when badge text does not contain colon', () => {
            document.body.innerHTML = `
                <div id="container">
                    <div class="yt-badge-shape__text">LIVE</div>
                </div>
            `;
            const video = { containingDiv: document.getElementById('container') };

            const duration = getVideoDuration(video);

            expect(duration).toBeNull();
        });
    });

    describe('isLivestream', () => {
        test('returns true when live badge CSS class present', () => {
            document.body.innerHTML = `
                <div id="container">
                    <div class="yt-badge-shape--thumbnail-live">LIVE</div>
                </div>
            `;
            const video = { containingDiv: document.getElementById('container') };

            expect(isLivestream(video)).toBe(true);
        });

        test('returns false when no live badge', () => {
            document.body.innerHTML = `<div id="container"></div>`;
            const video = { containingDiv: document.getElementById('container') };

            expect(isLivestream(video)).toBe(false);
        });
    });

    describe('isMembersOnly', () => {
        test('returns true when membership badge CSS class present', () => {
            document.body.innerHTML = `
                <div id="container">
                    <div class="yt-badge-shape--membership">Members only</div>
                </div>
            `;
            const video = { containingDiv: document.getElementById('container') };

            expect(isMembersOnly(video)).toBe(true);
        });

        test('returns false when no membership badge', () => {
            document.body.innerHTML = `<div id="container"></div>`;
            const video = { containingDiv: document.getElementById('container') };

            expect(isMembersOnly(video)).toBe(false);
        });
    });

    // Video class tests are skipped because JS classes in vm.runInContext
    // cannot be instantiated from outside the context. These would need
    // a different testing approach (e.g., bundling or different module system).
    describe.skip('Video class', () => {
        // Tests would go here if we had a proper module system
    });
});
