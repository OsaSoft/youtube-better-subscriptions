/**
 * pageContext.js runs in the page's world and tags what the content scripts can't read: the channel
 * of each card (from the renderer's .data) and of the channel page (#280). The collab data is a
 * trimmed real card; the single-channel card and the page metadata follow YouTube's usual shape and
 * aren't from a recorded page.
 */

const fs = require('fs');
const path = require('path');
const { loadSource } = require('../helpers/load-source');

const LTT_ID = 'UCXuqSBlHAE6Xw-yeJA0Tunw';
const collabData = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/collab-lockup-data-2026.json'), 'utf8'));

function singleChannelData(videoId, browseEndpoint) {
    return {
        content: {
            lockupViewModel: {
                contentId: videoId,
                metadata: {
                    lockupMetadataViewModel: {
                        image: {
                            decoratedAvatarViewModel: {
                                rendererContext: { commandContext: { onTap: { innertubeCommand: { browseEndpoint } } } },
                            },
                        },
                    },
                },
            },
        },
    };
}

describe('pageContext.js channel tagging', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        window.history.replaceState({}, '', '/feed/subscriptions');
        for (const key of Object.keys(document.documentElement.dataset)) {
            delete document.documentElement.dataset[key];
        }
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    function renderer(data) {
        const elem = document.createElement('ytd-rich-item-renderer');
        elem.data = data;
        document.body.appendChild(elem);
        return elem;
    }

    function load() {
        loadSource('pageContext.js', { location: window.location, Event: window.Event });
    }

    test('tags a collab with its uploader: the browseId and the handle from the list item subtitle', () => {
        document.body.innerHTML = '';
        const card = renderer(collabData);
        load();

        expect(card.dataset.ybsChannelId).toBe(LTT_ID);
        expect(card.dataset.ybsChannelUrl).toBe('/@LinusTechTips');
        expect(card.dataset.ybsChannelVideo).toBe('WCKCGqkKiII');
        // the collab filter's tag is still there
        expect(card.dataset.posterChannelId).toBe(LTT_ID);
    });

    test('tags a single-channel card from its avatar, with the handle from canonicalBaseUrl', () => {
        document.body.innerHTML = '';
        const card = renderer(singleChannelData('abc12345678', { browseId: LTT_ID, canonicalBaseUrl: '/@LinusTechTips' }));
        load();

        expect(card.dataset.ybsChannelId).toBe(LTT_ID);
        expect(card.dataset.ybsChannelUrl).toBe('/@LinusTechTips');
        expect(card.dataset.ybsChannelVideo).toBe('abc12345678');
    });

    test('tags a card again when its renderer gets another video', () => {
        document.body.innerHTML = '';
        const card = renderer(singleChannelData('abc12345678', { browseId: LTT_ID, canonicalBaseUrl: '/@LinusTechTips' }));
        load();
        card.data = singleChannelData('zzz98765432', { browseId: 'UCBJycsmduvYEL83R_U4JriQ' });
        jest.advanceTimersByTime(2000);

        expect(card.dataset.ybsChannelId).toBe('UCBJycsmduvYEL83R_U4JriQ');
        expect(card.dataset.ybsChannelUrl).toBeUndefined();
        expect(card.dataset.ybsChannelVideo).toBe('zzz98765432');
    });

    test('tags the channel page from the navigation response, and clears it when the next navigation starts', () => {
        document.body.innerHTML = '';
        load();
        const pageChannel = jest.fn();
        document.addEventListener('ybs-page-channel', pageChannel);

        window.history.replaceState({}, '', '/c/LinusTechTips/videos');
        const finish = new Event('yt-navigate-finish');
        finish.detail = { response: { response: { metadata: { channelMetadataRenderer: {
            externalId: LTT_ID, vanityChannelUrl: 'http://www.youtube.com/@LinusTechTips',
        } } } } };
        document.dispatchEvent(finish);

        const root = document.documentElement.dataset;
        expect(root.ybsPageChannelPath).toBe('/c/LinusTechTips/videos');
        expect(root.ybsPageChannelId).toBe(LTT_ID);
        expect(root.ybsPageChannelUrl).toBe('http://www.youtube.com/@LinusTechTips');
        expect(pageChannel).toHaveBeenCalled();

        document.dispatchEvent(new Event('yt-navigate-start'));
        expect(root.ybsPageChannelPath).toBeUndefined();
        expect(root.ybsPageChannelId).toBeUndefined();
        document.removeEventListener('ybs-page-channel', pageChannel);
    });

    test('tags the channel page from the visible ytd-browse when loaded on it', () => {
        window.history.replaceState({}, '', '/@LinusTechTips/videos');
        document.body.innerHTML = '<ytd-browse hidden></ytd-browse><ytd-browse></ytd-browse>';
        const [hiddenBrowse, visibleBrowse] = document.querySelectorAll('ytd-browse');
        hiddenBrowse.data = { metadata: { channelMetadataRenderer: { externalId: 'UCBJycsmduvYEL83R_U4JriQ' } } };
        visibleBrowse.data = { metadata: { channelMetadataRenderer: { externalId: LTT_ID, vanityChannelUrl: 'http://www.youtube.com/@LinusTechTips' } } };
        load();

        expect(document.documentElement.dataset.ybsPageChannelId).toBe(LTT_ID);
        expect(document.documentElement.dataset.ybsPageChannelPath).toBe('/@LinusTechTips/videos');
    });

    test('announces new card tags, once per batch', () => {
        document.body.innerHTML = '';
        load();
        const cardChannels = jest.fn();
        document.addEventListener('ybs-card-channels', cardChannels);
        renderer(singleChannelData('abc12345678', { browseId: LTT_ID }));
        renderer(singleChannelData('def12345678', { browseId: LTT_ID }));
        jest.advanceTimersByTime(2000);
        const calls = cardChannels.mock.calls.length;
        expect(calls).toBeGreaterThan(0);

        // nothing new: no event
        jest.advanceTimersByTime(2000);
        expect(cardChannels.mock.calls.length).toBe(calls);
        document.removeEventListener('ybs-card-channels', cardChannels);
    });

    test('a page tag read from ytd-browse is corrected when its data changes; one from the navigation is kept', () => {
        window.history.replaceState({}, '', '/c/LinusTechTips/videos');
        document.body.innerHTML = '<ytd-browse></ytd-browse>';
        const browse = document.querySelector('ytd-browse');
        browse.data = { metadata: { channelMetadataRenderer: { externalId: 'UCBJycsmduvYEL83R_U4JriQ' } } };
        load();
        expect(document.documentElement.dataset.ybsPageChannelId).toBe('UCBJycsmduvYEL83R_U4JriQ');

        browse.data = { metadata: { channelMetadataRenderer: { externalId: LTT_ID } } };
        jest.advanceTimersByTime(2000);
        expect(document.documentElement.dataset.ybsPageChannelId).toBe(LTT_ID);

        const finish = new Event('yt-navigate-finish');
        finish.detail = { response: { response: { metadata: { channelMetadataRenderer: { externalId: 'UCZYShIzcvrEBXqqjqYfMAsA' } } } } };
        document.dispatchEvent(finish);
        jest.advanceTimersByTime(2000);
        expect(document.documentElement.dataset.ybsPageChannelId).toBe('UCZYShIzcvrEBXqqjqYfMAsA');
    });

    test('builds the subscription cache (which opens the guide) only when asked', () => {
        document.body.innerHTML = '<ytd-guide-entry-renderer></ytd-guide-entry-renderer>';
        document.querySelector('ytd-guide-entry-renderer').data = { navigationEndpoint: { browseEndpoint: { browseId: LTT_ID } } };
        load();
        jest.advanceTimersByTime(5000);
        expect(document.documentElement.dataset.ytBetterSubsCache).toBeUndefined();

        document.dispatchEvent(new Event('ybs-build-subscription-cache'));
        expect(document.documentElement.dataset.ytBetterSubsCache).toBe(JSON.stringify([LTT_ID]));
    });
});
