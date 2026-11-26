/**
 * Channel exceptions (#280): channels whose premieres, live streams and members-only videos aren't
 * hidden by those three filters. Parsing and matching in channelExceptions.js, the hide rule in
 * Video.shouldHide().
 */

const { loadUtil, loadChannelExceptionsSource, loadVideo } = require('../helpers/load-source');

const LTT_ID = 'UCXuqSBlHAE6Xw-yeJA0Tunw';
const OTHER_ID = 'UCBJycsmduvYEL83R_U4JriQ';

describe('channel exceptions', () => {

    beforeEach(() => {
        window.history.replaceState({}, '', '/');
        document.head.innerHTML = '';
        loadUtil();
        loadChannelExceptionsSource();
    });

    describe('parseChannelInput', () => {
        test.each([
            ['@LinusTechTips', { id: null, handle: 'linustechtips' }],
            ['  @LinusTechTips  ', { id: null, handle: 'linustechtips' }],
            ['LinusTechTips', { id: null, handle: 'linustechtips' }],
            ['@LinusTechTips/videos', { id: null, handle: 'linustechtips' }],
            ['youtube.com/@LinusTechTips', { id: null, handle: 'linustechtips' }],
            ['www.youtube.com/@LinusTechTips/streams', { id: null, handle: 'linustechtips' }],
            ['m.youtube.com/@LinusTechTips', { id: null, handle: 'linustechtips' }],
            ['https://www.youtube.com/@LinusTechTips?si=abc', { id: null, handle: 'linustechtips' }],
            ['https://www.youtube.com/@%E3%81%82%E3%81%84%E3%81%86', { id: null, handle: 'あいう' }],
            ['@Tech.Channel_1-2', { id: null, handle: 'tech.channel_1-2' }],
            [LTT_ID, { id: LTT_ID, handle: null }],
            ['youtube.com/channel/' + LTT_ID, { id: LTT_ID, handle: null }],
            ['https://www.youtube.com/channel/' + LTT_ID + '/videos', { id: LTT_ID, handle: null }],
            ['/channel/' + LTT_ID, { id: LTT_ID, handle: null }],
        ])('%s', (input, expected) => {
            expect(parseChannelInput(input)).toEqual(expected);
        });

        test.each([
            '',
            '   ',
            '@',
            '@ab',
            'Linus Tech Tips',
            'youtube.com/c/LinusTechTips',
            'youtube.com/user/LinusTechTips',
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'https://youtu.be/dQw4w9WgXcQ',
            'https://example.com/@LinusTechTips',
            'youtube.com/channel/UCshort',
            null,
        ])('rejects %p', (input) => {
            expect(parseChannelInput(input)).toBeNull();
        });

        test('keeps the case of channel ids', () => {
            expect(parseChannelInput('youtube.com/channel/' + LTT_ID).id).toBe(LTT_ID);
        });
    });

    describe('channelFromHref', () => {
        test('reads card links', () => {
            expect(channelFromHref('/@TestChannelOne')).toEqual({ id: null, handle: 'testchannelone' });
            expect(channelFromHref('/channel/' + LTT_ID)).toEqual({ id: LTT_ID, handle: null });
            expect(channelFromHref('https://www.youtube.com/channel/' + LTT_ID)).toEqual({ id: LTT_ID, handle: null });
        });

        test('ignores links that are not channels', () => {
            expect(channelFromHref('/watch?v=abc12345678')).toBeNull();
            expect(channelFromHref('/shorts/abc12345678')).toBeNull();
            expect(channelFromHref('//evil.com/@x')).toBeNull();
            expect(channelFromHref(null)).toBeNull();
        });
    });

    describe('stored entries', () => {
        test('format and parse id, handle or both', () => {
            expect(formatChannelException({ id: LTT_ID, handle: 'linustechtips' })).toBe(LTT_ID + '@linustechtips');
            expect(formatChannelException({ id: null, handle: 'linustechtips' })).toBe('@linustechtips');
            expect(formatChannelException({ id: LTT_ID, handle: null })).toBe(LTT_ID);
            expect(parseChannelException(LTT_ID + '@linustechtips')).toEqual({ id: LTT_ID, handle: 'linustechtips' });
            expect(parseChannelException('@linustechtips')).toEqual({ id: null, handle: 'linustechtips' });
            expect(parseChannelException(LTT_ID)).toEqual({ id: LTT_ID, handle: null });
        });

        test('a damaged stored value is cleaned up', () => {
            expect(normalizeChannelExceptions(undefined)).toEqual([]);
            expect(normalizeChannelExceptions('x')).toEqual([]);
            expect(normalizeChannelExceptions(['@LinusTechTips', 42, '', 'garbage!', LTT_ID])).toEqual(['@linustechtips', LTT_ID]);
        });
    });

    describe('matching', () => {
        const list = ['@linustechtips', OTHER_ID];

        test('by handle, case-insensitively', () => {
            expect(isChannelInExceptions(list, channelFromHref('/@LinusTechTips'))).toBe(true);
            expect(isChannelInExceptions(list, parseChannelInput('@LINUSTECHTIPS'))).toBe(true);
        });

        test('by channel id', () => {
            expect(isChannelInExceptions(list, { id: OTHER_ID, handle: null })).toBe(true);
            expect(isChannelInExceptions(list, { id: OTHER_ID, handle: 'whatever' })).toBe(true);
        });

        test('an entry with both matches either form', () => {
            const both = [LTT_ID + '@linustechtips'];
            expect(isChannelInExceptions(both, { id: null, handle: 'linustechtips' })).toBe(true);
            expect(isChannelInExceptions(both, { id: LTT_ID, handle: null })).toBe(true);
        });

        test('ids are case-sensitive and other channels do not match', () => {
            expect(isChannelInExceptions(list, { id: OTHER_ID.toLowerCase(), handle: null })).toBe(false);
            expect(isChannelInExceptions(list, { id: null, handle: 'shortcircuit' })).toBe(false);
            expect(isChannelInExceptions(list, { id: LTT_ID, handle: null })).toBe(false);
            expect(isChannelInExceptions(list, null)).toBe(false);
        });
    });

    describe('add and remove', () => {
        test('adds a channel once', () => {
            const channel = { id: null, handle: 'linustechtips' };
            const first = addChannelException([], channel);
            expect(first).toEqual({ list: ['@linustechtips'], changed: true });
            expect(addChannelException(first.list, channel)).toEqual({ list: first.list, changed: false });
        });

        test('completes an entry with the half it lacked', () => {
            const result = addChannelException(['@linustechtips', OTHER_ID], { id: LTT_ID, handle: 'linustechtips' });
            expect(result).toEqual({ list: [LTT_ID + '@linustechtips', OTHER_ID], changed: true });
        });

        test('refuses a channel beyond the limit', () => {
            const full = Array.from({ length: MAX_CHANNEL_EXCEPTIONS }, (_, i) => '@channel' + i);
            expect(() => addChannelException(full, { id: null, handle: 'onemore' })).toThrow(/full/);
            // completing an existing entry is still fine
            expect(addChannelException(full, { id: LTT_ID, handle: 'channel3' }).changed).toBe(true);
        });

        test('removes by either form', () => {
            const list = [LTT_ID + '@linustechtips', OTHER_ID];
            expect(removeChannelException(list, { id: null, handle: 'linustechtips' })).toEqual([OTHER_ID]);
            expect(removeChannelException(list, { id: LTT_ID, handle: null })).toEqual([OTHER_ID]);
            expect(removeChannelException(list, { id: null, handle: 'nobody' })).toEqual(list);
        });
    });

    describe('storage', () => {
        test('starts empty: nothing is exempt for existing users', async () => {
            expect(await loadChannelExceptions()).toEqual([]);
            expect(hasChannelExceptions()).toBe(false);
            expect(isChannelExempt({ id: null, handle: 'linustechtips' })).toBe(false);
        });

        test('loads the list from sync storage under its own key', async () => {
            brwsr._setSyncStore({ channel_exceptions: ['@LinusTechTips'], settings: { 'settings.hide.members.only': true } });
            await loadChannelExceptions();
            expect(CHANNEL_EXCEPTIONS_KEY).toBe('channel_exceptions');
            expect(isChannelExempt({ id: null, handle: 'linustechtips' })).toBe(true);
        });

        test('updateChannelExceptions saves to sync storage and keeps other keys', async () => {
            brwsr._setSyncStore({ channel_exceptions: [OTHER_ID], settings: { a: 1 } });
            await updateChannelExceptions(list => addChannelException(list, { id: null, handle: 'linustechtips' }).list);
            expect(brwsr._getSyncStore()).toEqual({ channel_exceptions: [OTHER_ID, '@linustechtips'], settings: { a: 1 } });
            expect(isChannelExempt({ id: null, handle: 'linustechtips' })).toBe(true);
        });

        test('a failed save is reported and leaves the list as it was', async () => {
            brwsr.storage.sync.set.mockImplementationOnce((items, callback) => {
                brwsr._setLastError('QUOTA_BYTES quota exceeded');
                callback();
                brwsr._clearLastError();
            });
            await expect(updateChannelExceptions(list => [...list, '@linustechtips'])).rejects.toThrow(/QUOTA/);
            expect(isChannelExempt({ id: null, handle: 'linustechtips' })).toBe(false);
        });

        test('a change from elsewhere updates the list and notifies', () => {
            const callback = jest.fn();
            global.channelExceptionsChangedCallbacks.push(callback);
            brwsr._triggerStorageChange({ channel_exceptions: { newValue: ['@LinusTechTips'] } }, 'sync');
            expect(isChannelExempt({ id: null, handle: 'linustechtips' })).toBe(true);
            expect(callback).toHaveBeenCalledWith(['@linustechtips']);

            brwsr._triggerStorageChange({ settings: { newValue: {} } }, 'sync');
            brwsr._triggerStorageChange({ channel_exceptions: { newValue: [] } }, 'local');
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe('getCurrentChannel', () => {
        function loadAt(path, canonical) {
            window.history.replaceState({}, '', path);
            document.head.innerHTML = canonical ? `<link rel="canonical" href="${canonical}">` : '';
            loadChannelExceptionsSource();
        }

        test('is null off channel pages', () => {
            for (const path of ['/', '/feed/subscriptions', '/watch?v=abc12345678', '/c/LinusTechTips/videos']) {
                window.history.replaceState({}, '', path);
                expect(getCurrentChannel()).toBeNull();
            }
        });

        test('reads the handle or id from the URL', () => {
            window.history.replaceState({}, '', '/@LinusTechTips/videos');
            expect(getCurrentChannel()).toEqual({ id: null, handle: 'linustechtips' });
            window.history.replaceState({}, '', '/channel/' + LTT_ID + '/streams');
            expect(getCurrentChannel()).toEqual({ id: LTT_ID, handle: null });
        });

        test('adds the id from the canonical link on the page the document was loaded for', () => {
            loadAt('/@LinusTechTips/videos', 'https://www.youtube.com/channel/' + LTT_ID);
            expect(getCurrentChannel()).toEqual({ id: LTT_ID, handle: 'linustechtips' });

            // another tab of the same channel
            window.history.replaceState({}, '', '/@LinusTechTips/streams');
            expect(getCurrentChannel()).toEqual({ id: LTT_ID, handle: 'linustechtips' });
        });

        test('ignores the canonical link after navigating to another channel', () => {
            loadAt('/@LinusTechTips/videos', 'https://www.youtube.com/channel/' + LTT_ID);
            window.history.replaceState({}, '', '/@ShortCircuit/videos');
            expect(getCurrentChannel()).toEqual({ id: null, handle: 'shortcircuit' });
        });

        test('reads the canonical link only as it was when the page loaded', () => {
            loadAt('/@LinusTechTips/videos', 'https://www.youtube.com/channel/' + LTT_ID);
            document.head.innerHTML = '<link rel="canonical" href="https://www.youtube.com/channel/' + OTHER_ID + '">';
            expect(getCurrentChannel()).toEqual({ id: LTT_ID, handle: 'linustechtips' });
        });

        test('ignores a canonical link that disagrees with the URL', () => {
            loadAt('/channel/' + LTT_ID + '/videos', 'https://www.youtube.com/channel/' + OTHER_ID);
            expect(getCurrentChannel()).toEqual({ id: LTT_ID, handle: null });
        });
    });
});

describe('Video.shouldHide with channel exceptions', () => {
    // loads Video.js again so the class sees the hide flags and the exception list set here
    async function videoClass({ exceptions = [], watched = {}, flags = {} } = {}) {
        global.watchedVideos = watched;
        global.buildMarkWatchedButton = jest.fn(() => document.createElement('div'));
        global.processSections = jest.fn();
        global.watchVideo = jest.fn();
        global.syncWatchedVideos = jest.fn();
        Object.assign(global, {
            hideWatched: false, hidePremieres: false, hideShorts: false, hideLives: false,
            hideMembersOnly: false, hideCollabsUnsubscribed: false,
        }, flags);
        loadUtil();
        brwsr._setSyncStore({ channel_exceptions: exceptions });
        loadChannelExceptionsSource();
        await loadChannelExceptions();
        loadVideo();
        return global.Video;
    }

    // A feed card of the given kind from the given channel (link "/@handle" or "/channel/UC…")
    function card(kind, channelHref, videoId = 'abc12345678') {
        const badges = {
            regular: '<div class="ytBadgeShapeText">3:45</div>',
            premiere: '',
            live: '<div class="ytBadgeShapeThumbnailLive">LIVE</div>',
            members: '<div class="ytBadgeShapeText">3:45</div><div class="ytBadgeShapeCommerce">Members only</div>',
            short: '',
        };
        const href = kind === 'short' ? '/shorts/' + videoId : '/watch?v=' + videoId;
        document.body.innerHTML = `
            <ytd-rich-item-renderer id="container">
                <a id="video-title" href="${href}">Title</a>
                ${badges[kind]}
                <a class="ytAttributedStringLink" href="${channelHref}">Channel</a>
            </ytd-rich-item-renderer>
        `;
        return document.getElementById('container');
    }

    const ALL_THREE = { hidePremieres: true, hideLives: true, hideMembersOnly: true };

    beforeEach(() => {
        window.history.replaceState({}, '', '/feed/subscriptions');
    });

    test.each(['premiere', 'live', 'members'])('a %s card from an exempt channel is shown, from others hidden', async (kind) => {
        const Video = await videoClass({ exceptions: ['@linustechtips'], flags: ALL_THREE });
        expect(new Video(card(kind, '/@LinusTechTips')).shouldHide()).toBe(false);
        expect(new Video(card(kind, '/@ShortCircuit')).shouldHide()).toBe(true);
    });

    test('matches cards that link the channel by id', async () => {
        const Video = await videoClass({ exceptions: [LTT_ID], flags: ALL_THREE });
        expect(new Video(card('members', '/channel/' + LTT_ID)).shouldHide()).toBe(false);
        expect(new Video(card('members', '/channel/' + OTHER_ID)).shouldHide()).toBe(true);
    });

    test('with the filters off nothing changes', async () => {
        const Video = await videoClass({ exceptions: ['@linustechtips'] });
        expect(new Video(card('members', '/@ShortCircuit')).shouldHide()).toBe(false);
        expect(new Video(card('members', '/@LinusTechTips')).shouldHide()).toBe(false);
    });

    test('an empty list hides as before', async () => {
        const Video = await videoClass({ flags: ALL_THREE });
        expect(new Video(card('members', '/@LinusTechTips')).shouldHide()).toBe(true);
        expect(new Video(card('live', '/@LinusTechTips')).shouldHide()).toBe(true);
        expect(new Video(card('premiere', '/@LinusTechTips')).shouldHide()).toBe(true);
        expect(new Video(card('regular', '/@LinusTechTips')).shouldHide()).toBe(false);
    });

    test('never overrides Hide watched', async () => {
        const Video = await videoClass({
            exceptions: ['@linustechtips'],
            watched: { 'wabc12345678': 1000 },
            flags: { ...ALL_THREE, hideWatched: true },
        });
        expect(new Video(card('members', '/@LinusTechTips')).shouldHide()).toBe(true);
        expect(new Video(card('regular', '/@LinusTechTips')).shouldHide()).toBe(true);
    });

    test('never overrides Hide Shorts', async () => {
        const Video = await videoClass({ exceptions: ['@linustechtips'], flags: { ...ALL_THREE, hideShorts: true } });
        expect(new Video(card('short', '/@LinusTechTips')).shouldHide()).toBe(true);
    });

    test('never overrides the duration filters (#69)', async () => {
        global.settings = {
            ...DEFAULT_SETTINGS,
            'settings.hide.duration.shorter': true, 'settings.hide.duration.shorter.minutes': 10,
        };
        try {
            const Video = await videoClass({ exceptions: ['@linustechtips'], flags: ALL_THREE });
            // the regular and members cards are 3:45 long
            expect(new Video(card('regular', '/@LinusTechTips')).shouldHide()).toBe(true);
            expect(new Video(card('members', '/@LinusTechTips')).shouldHide()).toBe(true);
            expect(new Video(card('premiere', '/@LinusTechTips')).shouldHide()).toBe(false);
        } finally {
            global.settings = { ...DEFAULT_SETTINGS };
        }
    });

    test('never overrides the collab filter', async () => {
        global.isSubscriptionsPage = () => true;
        global.isSubscribedToChannel = () => false;
        const Video = await videoClass({ exceptions: ['@linustechtips'], flags: { ...ALL_THREE, hideCollabsUnsubscribed: true } });
        const div = card('members', '/@LinusTechTips');
        div.appendChild(document.createElement('yt-avatar-stack-view-model'));
        expect(new Video(div).shouldHide()).toBe(true);
        delete global.isSubscribedToChannel;
    });

    test('a collab card matches by the uploader pageContext.js tagged', async () => {
        const Video = await videoClass({ exceptions: [LTT_ID], flags: ALL_THREE });
        const div = card('members', '/@SomeoneElse');
        div.appendChild(document.createElement('yt-avatar-stack-view-model'));
        div.dataset.posterChannelId = LTT_ID;
        expect(new Video(div).shouldHide()).toBe(false);
    });

    test('on a channel page, cards without a channel link use the page channel', async () => {
        window.history.replaceState({}, '', '/@LinusTechTips/videos');
        const Video = await videoClass({ exceptions: ['@linustechtips'], flags: ALL_THREE });
        const div = card('members', '');
        div.querySelector('.ytAttributedStringLink').remove();
        expect(new Video(div).shouldHide()).toBe(false);

        window.history.replaceState({}, '', '/@ShortCircuit/videos');
        expect(new Video(div).shouldHide()).toBe(true);
    });
});

describe('channel exceptions: both halves of a channel', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/');
        document.head.innerHTML = '';
        for (const key of Object.keys(document.documentElement.dataset)) {
            delete document.documentElement.dataset[key];
        }
        loadUtil();
        loadChannelExceptionsSource();
    });

    // what pageContext.js writes on <html> from YouTube's data for a channel page
    function tagPage(path, id, url = 'http://www.youtube.com/@LinusTechTips') {
        Object.assign(document.documentElement.dataset, { ybsPageChannelPath: path, ybsPageChannelId: id, ybsPageChannelUrl: url });
    }

    describe('completeChannelException', () => {
        test('folds an id-only and a handle-only entry of the same channel into one', () => {
            const result = completeChannelException([LTT_ID, OTHER_ID, '@linustechtips'], { id: LTT_ID, handle: 'linustechtips' });
            expect(result).toEqual({ list: [LTT_ID + '@linustechtips', OTHER_ID], changed: true });
        });

        test('never adds a channel that is not on the list', () => {
            expect(completeChannelException([OTHER_ID], { id: LTT_ID, handle: 'linustechtips' })).toEqual({ list: [OTHER_ID], changed: false });
        });

        test('leaves the list as it is rather than grow it over the size cap', () => {
            // within 24 bytes (an id) of the cap
            const full = ['@linustechtips'];
            for (let i = 0; getChannelExceptionsBytes([...full, '@' + 'あ'.repeat(29) + i]) <= MAX_CHANNEL_EXCEPTIONS_BYTES - 10; i++) {
                full.push('@' + 'あ'.repeat(29) + i);
            }
            for (let i = 0; getChannelExceptionsBytes([...full, '@pad' + i]) <= MAX_CHANNEL_EXCEPTIONS_BYTES - 10; i++) {
                full.push('@pad' + i);
            }
            expect(getChannelExceptionsBytes(full)).toBeLessThan(MAX_CHANNEL_EXCEPTIONS_BYTES);
            expect(getChannelExceptionsBytes([LTT_ID + '@linustechtips', ...full.slice(1)])).toBeGreaterThan(MAX_CHANNEL_EXCEPTIONS_BYTES);
            expect(completeChannelException(full, { id: LTT_ID, handle: 'linustechtips' })).toEqual({ list: full, changed: false });
        });
    });

    describe('size cap', () => {
        test('refuses a channel that would take the list over its size in UTF-8 bytes', () => {
            const long = 'あ'.repeat(29);
            const list = [];
            let error = null;
            for (let i = 0; i < MAX_CHANNEL_EXCEPTIONS && !error; i++) {
                try {
                    list.splice(0, list.length, ...addChannelException(list, { id: null, handle: long + i }).list);
                } catch (e) {
                    error = e;
                }
            }
            expect(error).not.toBeNull();
            expect(error.message).toMatch(/full.*bytes/);
            expect(list.length).toBeLessThan(MAX_CHANNEL_EXCEPTIONS);
            expect(getChannelExceptionsBytes(list)).toBeLessThanOrEqual(MAX_CHANNEL_EXCEPTIONS_BYTES);
        });

        test('measures what the sync quota counts: key and JSON value in UTF-8', () => {
            expect(getChannelExceptionsBytes(['@あいう'])).toBe('channel_exceptions'.length + '["@"]'.length + 9);
        });
    });

    describe('getCurrentChannel with the page channel from pageContext.js', () => {
        test('adds the id after an in-page navigation, where the canonical link is not read', () => {
            window.history.replaceState({}, '', '/@LinusTechTips/videos');
            tagPage('/@LinusTechTips/videos', LTT_ID);
            expect(getCurrentChannel()).toEqual({ id: LTT_ID, handle: 'linustechtips' });

            // another tab of the same channel
            window.history.replaceState({}, '', '/@LinusTechTips/streams');
            expect(getCurrentChannel()).toEqual({ id: LTT_ID, handle: 'linustechtips' });
        });

        test('adds the handle on a /channel/ page', () => {
            window.history.replaceState({}, '', '/channel/' + LTT_ID + '/videos');
            tagPage('/channel/' + LTT_ID + '/videos', LTT_ID);
            expect(getCurrentChannel()).toEqual({ id: LTT_ID, handle: 'linustechtips' });
        });

        test('is ignored once on another channel page', () => {
            tagPage('/@LinusTechTips/videos', LTT_ID);
            window.history.replaceState({}, '', '/@ShortCircuit/videos');
            expect(getCurrentChannel()).toEqual({ id: null, handle: 'shortcircuit' });
        });

        test('is ignored when it disagrees with the URL', () => {
            window.history.replaceState({}, '', '/@ShortCircuit/videos');
            tagPage('/@ShortCircuit/videos', LTT_ID, 'http://www.youtube.com/@LinusTechTips');
            expect(getCurrentChannel()).toEqual({ id: null, handle: 'shortcircuit' });
        });

        test('names the channel of a legacy /c/ or /user/ page', () => {
            for (const path of ['/c/LinusTechTips/videos', '/user/LinusTechTips/streams']) {
                window.history.replaceState({}, '', path);
                expect(getCurrentChannel()).toBeNull();
                tagPage(path, LTT_ID);
                expect(getCurrentChannel()).toEqual({ id: LTT_ID, handle: 'linustechtips' });
            }
        });

        test('a legacy page loaded directly uses the canonical link', () => {
            window.history.replaceState({}, '', '/c/LinusTechTips/videos');
            document.head.innerHTML = '<link rel="canonical" href="https://www.youtube.com/channel/' + LTT_ID + '">';
            loadChannelExceptionsSource();
            expect(getCurrentChannel()).toEqual({ id: LTT_ID, handle: null });
        });

        test('an id-only entry matches the channel page after an in-page navigation', () => {
            window.history.replaceState({}, '', '/@LinusTechTips/videos');
            tagPage('/@LinusTechTips/videos', LTT_ID);
            expect(isChannelInExceptions([LTT_ID], getCurrentChannel())).toBe(true);
        });
    });
});

describe('Video.shouldHide: the channel of a card', () => {
    const fs = require('fs');
    const path = require('path');
    const ALL_THREE = { hidePremieres: true, hideLives: true, hideMembersOnly: true };

    async function videoClass(exceptions) {
        global.watchedVideos = {};
        global.buildMarkWatchedButton = jest.fn(() => document.createElement('div'));
        global.processSections = jest.fn();
        global.watchVideo = jest.fn();
        global.syncWatchedVideos = jest.fn();
        Object.assign(global, { hideWatched: false, hideShorts: false, hideCollabsUnsubscribed: false }, ALL_THREE);
        loadUtil();
        brwsr._setSyncStore({ channel_exceptions: exceptions });
        loadChannelExceptionsSource();
        await loadChannelExceptions();
        loadVideo();
        return global.Video;
    }

    // a members-only card; a collab names its channels in the avatar stack, the first link a co-creator's
    function card({ collab = false, link = '/@ShortCircuit', videoId = 'abc12345678' } = {}) {
        document.body.innerHTML = `
            <ytd-rich-item-renderer id="container">
                <a id="video-title" href="/watch?v=${videoId}">Title</a>
                <div class="ytBadgeShapeText">3:45</div><div class="ytBadgeShapeCommerce">Members only</div>
                ${collab ? '<yt-avatar-stack-view-model></yt-avatar-stack-view-model>' : ''}
                ${link ? `<a class="ytAttributedStringLink" href="${link}">Channel</a>` : ''}
            </ytd-rich-item-renderer>`;
        return document.getElementById('container');
    }

    // what pageContext.js writes on the card; for a collab the handle comes from the uploader's
    // list item subtitle, "‎⁨@LinusTechTips⁩ • ⁨16.8m subscribers⁩" in YouTube's data
    function tag(div, id, url, videoId = 'abc12345678') {
        Object.assign(div.dataset, { ybsChannelId: id, ybsChannelVideo: videoId });
        if (url) div.dataset.ybsChannelUrl = url;
        return div;
    }

    beforeEach(() => {
        window.history.replaceState({}, '', '/feed/subscriptions');
        for (const key of Object.keys(document.documentElement.dataset)) {
            delete document.documentElement.dataset[key];
        }
    });

    test('a handle-only entry matches a collab by its tagged uploader', async () => {
        const Video = await videoClass(['@linustechtips']);
        expect(new Video(tag(card({ collab: true }), LTT_ID, '/@LinusTechTips')).shouldHide()).toBe(false);
        expect(new Video(tag(card({ collab: true, link: '/@LinusTechTips' }), OTHER_ID, '/@ShortCircuit')).shouldHide()).toBe(true);
    });

    test('an id-only entry matches a feed card by the id pageContext.js tagged', async () => {
        const Video = await videoClass([LTT_ID]);
        expect(new Video(tag(card({ link: '/@LinusTechTips' }), LTT_ID, '/@LinusTechTips')).shouldHide()).toBe(false);
        expect(new Video(tag(card({ link: '/@ShortCircuit' }), OTHER_ID, '/@ShortCircuit')).shouldHide()).toBe(true);
    });

    test('a tag read for another video (a reused renderer) is ignored', async () => {
        const Video = await videoClass([LTT_ID]);
        expect(new Video(tag(card({ link: '/@ShortCircuit' }), LTT_ID, '/@LinusTechTips', 'zzz98765432')).shouldHide()).toBe(true);
    });

    test('a collab not tagged yet stays visible while there are exceptions, then is checked again', async () => {
        const Video = await videoClass(['@linustechtips']);
        // its first link is a co-creator's: not taken for the uploader
        const div = card({ collab: true, link: '/@LinusTechTips' });
        expect(new Video(div).shouldHide()).toBe(false);

        tag(div, OTHER_ID, '/@ShortCircuit');
        expect(new Video(div).shouldHide()).toBe(true);
    });

    test('a card without a known channel stays visible while there are exceptions', async () => {
        const Video = await videoClass(['@linustechtips']);
        expect(new Video(card({ link: null })).shouldHide()).toBe(false);
    });

    test('without exceptions an unknown channel hides as before', async () => {
        const Video = await videoClass([]);
        expect(new Video(card({ collab: true, link: null })).shouldHide()).toBe(true);
        expect(new Video(card({ link: null })).shouldHide()).toBe(true);
    });

    test('on a real 2026 feed card the "/@handle" channel link is matched', async () => {
        const Video = await videoClass(['@testchannel_a']);
        document.body.innerHTML = fs.readFileSync(path.join(__dirname, '../fixtures/subscription-feed-2026.html'), 'utf8');
        const cardOf = (videoId) => document.querySelector(`a[href^="/watch?v=${videoId}"]`).closest('ytd-rich-item-renderer');
        for (const videoId of ['testVid_001', 'testVid_002']) {
            const badge = document.createElement('div');
            badge.className = 'ytBadgeShapeCommerce';
            cardOf(videoId).querySelector('yt-lockup-view-model').appendChild(badge);
        }

        expect(new Video(cardOf('testVid_001')).shouldHide()).toBe(false);
        expect(new Video(cardOf('testVid_002')).shouldHide()).toBe(true);
    });
});
