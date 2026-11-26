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
                    <div class="ytBadgeShapeText">10:30</div>
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
                    <div class="ytBadgeShapeText">LIVE</div>
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

        test('returns true when camelCase live badge class present (2026-08 layout)', () => {
            document.body.innerHTML = `
                <div id="container">
                    <badge-shape class="ytBadgeShapeHost ytBadgeShapeThumbnailLive ytBadgeShapeThumbnailBadge">
                        <div class="ytBadgeShapeText">LIVE</div>
                    </badge-shape>
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

        test('returns true when camelCase membership badge class present', () => {
            document.body.innerHTML = `
                <div id="container">
                    <yt-badge-view-model class="ytBadgeViewModelHost">
                        <badge-shape class="ytBadgeShapeHost ytBadgeShapeCommerce ytBadgeShapeModern ytBadgeShapeTypography">
                            <div class="ytBadgeShapeText">Members only</div>
                        </badge-shape>
                    </yt-badge-view-model>
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

    describe('isMix detection via Video constructor', () => {
        const { loadSubscriptionsVideo } = require('../helpers/load-source');

        function createVideoDiv(href) {
            document.body.innerHTML = `
                <div id="container">
                    <a id="video-title" href="${href}">Title</a>
                    <div class="ytBadgeShapeText">3:45</div>
                </div>
            `;
            return document.getElementById('container');
        }

        function createVideo(href, watchedVideosMap, hideWatchedVal) {
            global.watchedVideos = watchedVideosMap || {};
            global.hideWatched = hideWatchedVal || false;
            const context = loadSubscriptionsVideo();
            const div = createVideoDiv(href);
            // Use vm.runInContext to create the Video inside the same context
            const vm = require('vm');
            // Attach the div to the context so it's accessible
            context.__testDiv = div;
            return vm.runInContext(
                '(function() { var v = new Video(__testDiv); return { isMix: v.isMix, isStored: v.isStored, shouldHide: v.shouldHide() }; })()',
                context
            );
        }

        test('isMix is true when URL contains start_radio=1', () => {
            const result = createVideo(
                '/watch?v=abc12345678&list=RDabc12345678&start_radio=1',
                { 'wabc12345678': true }
            );
            expect(result.isMix).toBe(true);
        });

        test('isMix is false for regular watch URL', () => {
            const result = createVideo('/watch?v=abc12345678', {});
            expect(result.isMix).toBe(false);
        });

        test('isMix is false for playlist URL without start_radio', () => {
            const result = createVideo('/watch?v=abc12345678&list=PLtest123', {});
            expect(result.isMix).toBe(false);
        });

        test('watched mix is not hidden when hideWatched is true', () => {
            const result = createVideo(
                '/watch?v=abc12345678&list=RDabc12345678&start_radio=1',
                { 'wabc12345678': true },
                true
            );
            expect(result.isStored).toBe(true);
            expect(result.isMix).toBe(true);
            expect(result.shouldHide).toBe(false);
        });

        test('manually marking a mix as watched does not trigger hide', () => {
            global.watchedVideos = {};
            global.hideWatched = true;
            const context = loadSubscriptionsVideo();
            const div = createVideoDiv('/watch?v=abc12345678&list=RDabc12345678&start_radio=1');
            context.__testDiv = div;
            const vm = require('vm');
            const result = vm.runInContext(
                '(function() { var v = new Video(__testDiv); v.markWatched(); return { hidden: v.containingDiv.style.display === "none", isMix: v.isMix }; })()',
                context
            );
            expect(result.isMix).toBe(true);
            expect(result.hidden).toBe(false);
        });

        test('watched non-mix video is still hidden when hideWatched is true', () => {
            const result = createVideo(
                '/watch?v=abc12345678',
                { 'wabc12345678': true },
                true
            );
            expect(result.isStored).toBe(true);
            expect(result.isMix).toBe(false);
            expect(result.shouldHide).toBe(true);
        });
    });

    describe('collaboration detection via Video constructor', () => {
        const { loadSubscriptionsVideo } = require('../helpers/load-source');
        const vm = require('vm');

        function createCollabVideoDiv(hasAvatarStack, href = '/watch?v=abc12345678') {
            const avatarStackHtml = hasAvatarStack
                ? '<yt-avatar-stack-view-model></yt-avatar-stack-view-model>'
                : '<div class="single-avatar"></div>';
            document.body.innerHTML = `
                <div id="container">
                    <a id="video-title" href="${href}">Title</a>
                    <div class="ytBadgeShapeText">3:45</div>
                    ${avatarStackHtml}
                </div>
            `;
            return document.getElementById('container');
        }

        function makeVideo(hasAvatarStack, opts = {}) {
            global.watchedVideos = opts.watchedVideos || {};
            global.hideWatched = opts.hideWatched || false;
            global.hideCollabsUnsubscribed = opts.hideCollabsUnsubscribed || false;
            global.isSubscribedToChannel = opts.isSubscribedToChannel || (() => true);
            global.isSubscriptionsPage = opts.isSubscriptionsPage !== undefined ? opts.isSubscriptionsPage : (() => true);
            const context = loadSubscriptionsVideo();
            const div = createCollabVideoDiv(hasAvatarStack);
            context.__testDiv = div;
            return vm.runInContext(
                '(function() { var v = new Video(__testDiv); return { isCollaboration: v.isCollaboration, shouldHide: v.shouldHide() }; })()',
                context
            );
        }

        test('isCollaboration is true when yt-avatar-stack-view-model present', () => {
            const result = makeVideo(true);
            expect(result.isCollaboration).toBe(true);
        });

        test('isCollaboration is false when no avatar stack', () => {
            const result = makeVideo(false);
            expect(result.isCollaboration).toBe(false);
        });

        test('collab video not hidden when setting is off', () => {
            const result = makeVideo(true, {
                hideCollabsUnsubscribed: false,
                isSubscribedToChannel: () => false
            });
            expect(result.isCollaboration).toBe(true);
            expect(result.shouldHide).toBe(false);
        });

        test('collab video hidden when setting on, not subscribed to poster, on subs page', () => {
            const result = makeVideo(true, {
                hideCollabsUnsubscribed: true,
                isSubscribedToChannel: () => false,
                isSubscriptionsPage: () => true
            });
            expect(result.shouldHide).toBe(true);
        });

        test('collab video not hidden when subscribed to poster', () => {
            const result = makeVideo(true, {
                hideCollabsUnsubscribed: true,
                isSubscribedToChannel: () => true,
                isSubscriptionsPage: () => true
            });
            expect(result.shouldHide).toBe(false);
        });

        test('collab video not hidden on non-subscription pages', () => {
            const result = makeVideo(true, {
                hideCollabsUnsubscribed: true,
                isSubscribedToChannel: () => false,
                isSubscriptionsPage: () => false
            });
            expect(result.shouldHide).toBe(false);
        });

        test('collab video not hidden on channel page', () => {
            const result = makeVideo(true, {
                hideCollabsUnsubscribed: true,
                isSubscribedToChannel: () => false,
                isSubscriptionsPage: () => false
            });
            expect(result.shouldHide).toBe(false);
        });

        test('non-collab video not hidden even with setting on', () => {
            const result = makeVideo(false, {
                hideCollabsUnsubscribed: true,
                isSubscribedToChannel: () => false,
                isSubscriptionsPage: () => true
            });
            expect(result.shouldHide).toBe(false);
        });
    });

    describe('getPosterChannelId', () => {
        test('returns null when no data-poster-channel-id attribute', () => {
            document.body.innerHTML = `
                <ytd-rich-item-renderer>
                    <div id="container">
                        <a id="video-title" href="/watch?v=abc12345678">Title</a>
                        <div class="ytBadgeShapeText">3:45</div>
                    </div>
                </ytd-rich-item-renderer>
            `;
            const video = { containingDiv: document.getElementById('container'), _posterChannelId: undefined };
            const result = getPosterChannelId(video);
            expect(result).toBeNull();
        });

        test('reads data-poster-channel-id from parent ytd-rich-item-renderer', () => {
            document.body.innerHTML = `
                <ytd-rich-item-renderer data-poster-channel-id="UCXuqSBlHAE6Xw-yeJA0Tunw">
                    <div id="container">
                        <a id="video-title" href="/watch?v=abc12345678">Title</a>
                    </div>
                </ytd-rich-item-renderer>
            `;
            const video = { containingDiv: document.getElementById('container'), _posterChannelId: undefined };
            const result = getPosterChannelId(video);
            expect(result).toBe('UCXuqSBlHAE6Xw-yeJA0Tunw');
        });

        test('caches non-null result after first call', () => {
            document.body.innerHTML = `
                <ytd-rich-item-renderer data-poster-channel-id="UC12345">
                    <div id="container"></div>
                </ytd-rich-item-renderer>
            `;
            const video = { containingDiv: document.getElementById('container'), _posterChannelId: undefined };
            getPosterChannelId(video);
            expect(video._posterChannelId).toBe('UC12345');
            // Second call should return cached value even if attribute removed
            document.querySelector('ytd-rich-item-renderer').removeAttribute('data-poster-channel-id');
            expect(getPosterChannelId(video)).toBe('UC12345');
        });

        test('does not cache null - allows re-check when attribute appears later', () => {
            document.body.innerHTML = `
                <ytd-rich-item-renderer>
                    <div id="container"></div>
                </ytd-rich-item-renderer>
            `;
            const video = { containingDiv: document.getElementById('container'), _posterChannelId: undefined };
            expect(getPosterChannelId(video)).toBeNull();
            // Attribute added later (by pageContext.js)
            document.querySelector('ytd-rich-item-renderer').dataset.posterChannelId = 'UCabc';
            expect(getPosterChannelId(video)).toBe('UCabc');
        });
    });

    describe('Video class', () => {
        // loads Video.js again so the class sees the hide flags and watched videos set here
        function videoClass({ watched = {}, flags = {} } = {}) {
            global.watchedVideos = watched;
            Object.assign(global, {
                hideWatched: false, hidePremieres: false, hideShorts: false, hideLives: false,
                hideMembersOnly: false, hideCollabsUnsubscribed: false,
            }, flags);
            loadVideo();
            return global.Video;
        }

        function card(href, duration = '3:45') {
            document.body.innerHTML = `
                <div id="container">
                    <a id="video-title" href="${href}">Title</a>
                    ${duration ? `<div class="ytBadgeShapeText">${duration}</div>` : ''}
                </div>
            `;
            return document.getElementById('container');
        }

        test('reads the video id and whether it is stored as watched', () => {
            const Video = videoClass({ watched: { 'wabc12345678': 1000 } });

            const watched = new Video(card('/watch?v=abc12345678'));
            const other = new Video(card('/watch?v=xyz12345678'));

            expect(watched.videoId).toBe('abc12345678');
            expect(watched.isStored).toBeTruthy();
            expect(watched.buttonId).toBe(MARK_UNWATCHED_BTN);
            expect(other.isStored).toBeFalsy();
            expect(other.buttonId).toBe(MARK_WATCHED_BTN);
        });

        test('a shorts link is a short, not a premiere', () => {
            const Video = videoClass();
            const video = new Video(card('/shorts/abc12345678', null));

            expect(video.isShort).toBe(true);
            expect(video.isPremiere).toBeFalsy();
        });

        test('a regular video without a duration badge is a premiere', () => {
            const Video = videoClass();
            const video = new Video(card('/watch?v=abc12345678', null));

            expect(video.isShort).toBe(false);
            expect(video.isPremiere).toBe(true);
        });

        test('shouldHide follows the hide flags', () => {
            const watched = { 'wabc12345678': 1000 };
            expect(new (videoClass({ watched, flags: { hideWatched: true } }))(card('/watch?v=abc12345678')).shouldHide()).toBe(true);
            expect(new (videoClass({ watched, flags: { hideWatched: false } }))(card('/watch?v=abc12345678')).shouldHide()).toBe(false);
            expect(new (videoClass({ flags: { hideShorts: true } }))(card('/shorts/abc12345678', null)).shouldHide()).toBe(true);
            expect(new (videoClass({ flags: { hidePremieres: true } }))(card('/watch?v=abc12345678', null)).shouldHide()).toBe(true);
            expect(new (videoClass({ flags: { hideShorts: true, hidePremieres: true } }))(card('/watch?v=abc12345678')).shouldHide()).toBe(false);
        });

        describe('duration filters (#69)', () => {
            const SHORTER = { 'settings.hide.duration.shorter': true, 'settings.hide.duration.shorter.minutes': 20 };
            const LONGER = { 'settings.hide.duration.longer': true, 'settings.hide.duration.longer.minutes': 60 };

            function hides(duration, durationSettings, href = '/watch?v=abc12345678', flags = {}) {
                global.settings = { ...DEFAULT_SETTINGS, ...durationSettings };
                const Video = videoClass({ flags });
                return new Video(card(href, duration)).shouldHide();
            }

            test.each([
                ['0:45', 45],
                ['9:59', 599],
                ['56:28', 3388],
                ['1:29:19', 5359],
                ['10:00:00', 36000],
                ['  12:05 \n', 725],
            ])('parseDurationSeconds(%j) is %d', (text, seconds) => {
                expect(parseDurationSeconds(text)).toBe(seconds);
            });

            test.each(['SHORTS', 'LIVE', '', '1:2', '1:2:3', '12', ':45', '1:60x', null, undefined])
            ('parseDurationSeconds(%j) is null', (text) => {
                expect(parseDurationSeconds(text)).toBeNull();
            });

            test('both filters are off by default and hide nothing', () => {
                for (const duration of ['0:45', '19:59', '1:00:01', '10:00:00']) {
                    expect(hides(duration, {})).toBe(false);
                }
            });

            test('"shorter than" hides videos under the limit; exactly the limit stays', () => {
                expect(hides('19:59', SHORTER)).toBe(true);
                expect(hides('0:45', SHORTER)).toBe(true);
                expect(hides('20:00', SHORTER)).toBe(false);
                expect(hides('1:29:19', SHORTER)).toBe(false);
            });

            test('"longer than" hides videos over the limit; exactly the limit stays', () => {
                expect(hides('1:00:01', LONGER)).toBe(true);
                expect(hides('3:12:45', LONGER)).toBe(true);
                expect(hides('1:00:00', LONGER)).toBe(false);
                expect(hides('60:00', LONGER)).toBe(false);
                expect(hides('0:45', LONGER)).toBe(false);
            });

            test('both on keep only videos in between, limits included', () => {
                const both = { ...SHORTER, ...LONGER };
                expect(hides('19:59', both)).toBe(true);
                expect(hides('20:00', both)).toBe(false);
                expect(hides('56:28', both)).toBe(false);
                expect(hides('1:00:00', both)).toBe(false);
                expect(hides('1:00:01', both)).toBe(true);
            });

            test('reads the duration past a "Members only" badge before it', () => {
                global.settings = { ...DEFAULT_SETTINGS, ...SHORTER };
                const Video = videoClass();
                document.body.innerHTML = `
                    <div id="container">
                        <a id="video-title" href="/watch?v=abc12345678">Title</a>
                        <div class="ytBadgeShapeText">Members only</div>
                        <div class="ytBadgeShapeText">5:10</div>
                    </div>
                `;
                expect(new Video(document.getElementById('container')).shouldHide()).toBe(true);
            });

            test('Shorts, live streams and premieres are never hidden by it', () => {
                const both = { ...SHORTER, ...LONGER };
                expect(hides(null, both, '/shorts/abc12345678')).toBe(false);
                expect(hides('0:30', both, '/shorts/abc12345678')).toBe(false);
                expect(hides(null, both)).toBe(false); // premiere: no badge

                global.settings = { ...DEFAULT_SETTINGS, ...both };
                const Video = videoClass();
                document.body.innerHTML = `
                    <div id="container">
                        <a id="video-title" href="/watch?v=abc12345678">Title</a>
                        <div class="ytBadgeShapeThumbnailLive"><div class="ytBadgeShapeText">LIVE</div></div>
                    </div>
                `;
                const live = new Video(document.getElementById('container'));
                expect(live.isLivestream).toBe(true);
                expect(live.shouldHide()).toBe(false);
            });

            test('a live stream showing a running time is not hidden by it', () => {
                global.settings = { ...DEFAULT_SETTINGS, ...SHORTER };
                const Video = videoClass();
                document.body.innerHTML = `
                    <div id="container">
                        <a id="video-title" href="/watch?v=abc12345678">Title</a>
                        <div class="ytBadgeShapeThumbnailLive"><div class="ytBadgeShapeText">1:05</div></div>
                    </div>
                `;
                expect(new Video(document.getElementById('container')).shouldHide()).toBe(false);
            });

            test('an odd badge text is not a duration and hides nothing', () => {
                expect(hides('1:2', { ...SHORTER, ...LONGER })).toBe(false);
                expect(hides('12:34 extra', { ...SHORTER, ...LONGER })).toBe(false);
            });

            test.each(['', 0, -5, 'abc', null, NaN])('a minutes value of %j turns that filter off', (minutes) => {
                expect(hides('0:45', { ...SHORTER, 'settings.hide.duration.shorter.minutes': minutes })).toBe(false);
                expect(hides('10:00:00', { ...LONGER, 'settings.hide.duration.longer.minutes': minutes })).toBe(false);
            });

            test('minutes saved as a string still work', () => {
                expect(hides('5:00', { ...SHORTER, 'settings.hide.duration.shorter.minutes': '10' })).toBe(true);
                expect(hides('15:00', { ...SHORTER, 'settings.hide.duration.shorter.minutes': '10' })).toBe(false);
            });

            test('a watched video outside the limits is hidden even with Hide watched off', () => {
                global.settings = { ...DEFAULT_SETTINGS, ...SHORTER };
                const Video = videoClass({ watched: { 'wabc12345678': 1000 }, flags: { hideWatched: false } });
                expect(new Video(card('/watch?v=abc12345678', '3:00')).shouldHide()).toBe(true);
            });
        });

        test('hide() hides the card and remembers it', () => {
            const Video = videoClass();
            const div = card('/watch?v=abc12345678');

            new Video(div).hide();

            expect(div.style.display).toBe('none');
            expect(div.classList.contains(HIDDEN_CLASS)).toBe(true);
            expect(global.hidden).toContain(div);
        });

        test('markWatched stores and syncs the video, and hides it while hiding watched', () => {
            const Video = videoClass({ flags: { hideWatched: true } });
            const div = card('/watch?v=abc12345678');
            const video = new Video(div);

            video.markWatched();

            expect(global.watchVideo).toHaveBeenCalledWith('abc12345678');
            expect(global.syncWatchedVideos).toHaveBeenCalled();
            expect(video.isStored).toBe(true);
            expect(video.buttonId).toBe(MARK_UNWATCHED_BTN);
            expect(div.style.display).toBe('none');
            expect(global.processSections).toHaveBeenCalled();
        });

        test('markUnwatched unstores and syncs the video', () => {
            const Video = videoClass({ watched: { 'wabc12345678': 1000 } });

            new Video(card('/watch?v=abc12345678')).markUnwatched();

            expect(global.unwatchVideo).toHaveBeenCalledWith('abc12345678');
            expect(global.syncWatchedVideos).toHaveBeenCalled();
        });

        test('leaves the buttons to subclasses', () => {
            const Video = videoClass();
            const video = new Video(card('/watch?v=abc12345678'));

            expect(() => video.hasButton()).toThrow('Subclasses must implement hasButton method');
            expect(() => video.addButton()).toThrow('Subclasses must implement addButton method');
            expect(video.getFadeTarget()).toBeNull();
        });
    });
});
