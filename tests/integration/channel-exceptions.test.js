/**
 * Channel exceptions (#280) on a channel page: the "Show ... here" switch in the header controls
 * adds the channel to the list or takes it off, and the members-only cards come back or go again
 * without a reload. Edits from elsewhere (settings page, another tab) apply the same way.
 */

const fs = require('fs');
const path = require('path');
const { loadUtil, loadQueries, loadChannelExceptionsSource, loadSubscriptionsVideo, loadSubsUI, loadSubs } = require('../helpers/load-source');

const PREFIX = "osasoft-better-subscriptions_";
const TOGGLE_ID = PREFIX + "channel-exception-toggle";
const LTT_ID = 'UCXuqSBlHAE6Xw-yeJA0Tunw';

const membersOnlyCard = fs.readFileSync(path.join(__dirname, '../fixtures/members-only-card-2026-10.html'), 'utf8');

const regularCard = `
<ytd-rich-item-renderer class="style-scope ytd-rich-grid-renderer" id="regular">
    <a id="video-title" href="/watch?v=regularVid1">Regular</a>
    <div class="ytBadgeShapeText">12:34</div>
</ytd-rich-item-renderer>`;

// what pageContext.js writes on <html> from YouTube's data for the channel page
function tagPage(pagePath, id, url = 'http://www.youtube.com/@LinusTechTips') {
    Object.assign(document.documentElement.dataset, { ybsPageChannelPath: pagePath, ybsPageChannelId: id, ybsPageChannelUrl: url });
}

function clearPageChannel() {
    for (const key of Object.keys(document.documentElement.dataset)) {
        if (key.startsWith('ybsPageChannel')) delete document.documentElement.dataset[key];
    }
}

describe('channel exception switch on a channel page', () => {
    let subs;

    async function setup({ path: pagePath = '/@LinusTechTips/videos', exceptions = [], flags = { hideMembersOnly: true }, canonical, pageChannel, cardLink } = {}) {
        window.history.replaceState({}, '', pagePath);
        clearPageChannel();
        if (pageChannel) {
            tagPage(pagePath, pageChannel);
        }
        document.head.innerHTML = canonical ? `<link rel="canonical" href="${canonical}">` : '';
        document.body.innerHTML = `
            <div id="end"></div>
            <ytd-rich-grid-renderer id="grid">${membersOnlyCard}${regularCard}</ytd-rich-grid-renderer>`;
        if (cardLink) {
            // a feed card links its channel by handle
            const link = document.createElement('a');
            link.href = cardLink;
            document.querySelector('.content-id-memberVid01').closest('ytd-rich-item-renderer').appendChild(link);
        }

        Object.assign(global, { hidePremieres: false, hideLives: false, hideMembersOnly: false }, flags);
        settings["settings.hide.premieres"] = global.hidePremieres;
        settings["settings.hide.lives"] = global.hideLives;
        settings["settings.hide.members.only"] = global.hideMembersOnly;
        settings["settings.hide.watched.default"] = true;
        brwsr._setSyncStore({ channel_exceptions: exceptions });

        global.isSubscriptionsPage = () => false;
        global.getCurrentPage = () => pagePath.replace(/\/$/, '');
        global.watchedVideos = {};
        global.watchVideo = jest.fn();
        global.syncWatchedVideos = jest.fn();
        global.loadWatchedVideos = jest.fn(async () => {});
        global.loadStopLoadingOlder = jest.fn(async () => {});
        global.loadMoreVideos = jest.fn();
        // subs.js defines it, after subs-ui.js reads it from the shared scope
        global.isYouTubeWatched = () => false;
        global.buildMarkWatchedButton = jest.fn(() => document.createElement("div"));

        loadUtil();
        loadQueries();
        loadChannelExceptionsSource();
        loadSubscriptionsVideo();
        loadSubsUI();
        subs = loadSubs();

        await subs.initSubs();
    }

    afterEach(() => {
        if (subs) {
            subs.stopSubs();
        }
        subs = null;
    });

    const toggle = () => document.getElementById(TOGGLE_ID);
    const membersCard = () => document.querySelector('.content-id-memberVid01').closest('ytd-rich-item-renderer');
    const isHidden = (elem) => elem.style.display === 'none';
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    test('shows the switch, off, and the members-only card is hidden', async () => {
        await setup();

        expect(toggle()).not.toBeNull();
        expect(toggle().textContent).toBe('Show members-only here');
        expect(toggle().getAttribute('role')).toBe('switch');
        expect(toggle().querySelector('.subs-channel-exception__track .subs-channel-exception__knob')).not.toBeNull();
        expect(toggle().getAttribute('aria-checked')).toBe('false');
        expect(toggle().getAttribute('title')).toMatch(/members-only videos from this channel are hidden/);
        expect(isHidden(membersCard())).toBe(true);
        expect(isHidden(document.getElementById('regular'))).toBe(false);
    });

    test('clicking it exempts the channel and shows the card; clicking again hides it', async () => {
        await setup();

        toggle().click();
        await flush();

        expect(brwsr._getSyncStore().channel_exceptions).toEqual(['@linustechtips']);
        expect(toggle().getAttribute('aria-checked')).toBe('true');
        expect(isHidden(membersCard())).toBe(false);

        toggle().click();
        await flush();

        expect(brwsr._getSyncStore().channel_exceptions).toEqual([]);
        expect(toggle().getAttribute('aria-checked')).toBe('false');
        expect(isHidden(membersCard())).toBe(true);
        expect(isHidden(document.getElementById('regular'))).toBe(false);
    });

    test('an exempt channel loads with the switch on and its card never hidden', async () => {
        await setup({ exceptions: ['@linustechtips'] });

        expect(toggle().getAttribute('aria-checked')).toBe('true');
        expect(isHidden(membersCard())).toBe(false);
    });

    test('an entry added by channel URL matches the page through the canonical link and gets the handle', async () => {
        await setup({ exceptions: [LTT_ID], canonical: 'https://www.youtube.com/channel/' + LTT_ID });
        await flush();

        expect(toggle().getAttribute('aria-checked')).toBe('true');
        expect(isHidden(membersCard())).toBe(false);
        expect(brwsr._getSyncStore().channel_exceptions).toEqual([LTT_ID + '@linustechtips']);
    });

    test('a change from elsewhere applies without a reload', async () => {
        await setup();

        brwsr.storage.sync.set({ channel_exceptions: ['@LinusTechTips'] });
        expect(toggle().getAttribute('aria-checked')).toBe('true');
        expect(isHidden(membersCard())).toBe(false);

        brwsr.storage.sync.set({ channel_exceptions: [] });
        expect(toggle().getAttribute('aria-checked')).toBe('false');
        expect(isHidden(membersCard())).toBe(true);
    });

    test('another channel on the list does not exempt this one', async () => {
        await setup({ exceptions: ['@shortcircuit'] });

        expect(toggle().getAttribute('aria-checked')).toBe('false');
        expect(isHidden(membersCard())).toBe(true);
    });

    test('the label names the one filter that is on', async () => {
        await setup({ flags: { hideLives: true } });

        expect(toggle().textContent).toBe('Show live streams here');
    });

    test('with several filters on the label is general and the title names them', async () => {
        await setup({ flags: { hidePremieres: true, hideLives: true, hideMembersOnly: true } });

        expect(toggle().textContent).toBe('Show hidden types here');
        expect(toggle().getAttribute('title')).toMatch(/premieres, live streams and members-only videos/);
    });

    test('Enter and Space toggle it from the keyboard', async () => {
        await setup();

        toggle().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await flush();
        expect(toggle().getAttribute('aria-checked')).toBe('true');

        toggle().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        await flush();
        expect(toggle().getAttribute('aria-checked')).toBe('false');
    });

    test('no switch while the three filters are off', async () => {
        await setup({ flags: {} });

        expect(toggle()).toBeNull();
        expect(isHidden(membersCard())).toBe(false);
    });

    test('after an in-page navigation an id-only entry matches through the page channel, without a duplicate on toggle', async () => {
        await setup({ exceptions: [LTT_ID], pageChannel: LTT_ID });
        await flush();

        expect(toggle().getAttribute('aria-checked')).toBe('true');
        expect(isHidden(membersCard())).toBe(false);
        // completed with the handle, not added again as "@linustechtips"
        expect(brwsr._getSyncStore().channel_exceptions).toEqual([LTT_ID + '@linustechtips']);

        toggle().click();
        await flush();
        expect(brwsr._getSyncStore().channel_exceptions).toEqual([]);
        expect(isHidden(membersCard())).toBe(true);

        toggle().click();
        await flush();
        expect(brwsr._getSyncStore().channel_exceptions).toEqual([LTT_ID + '@linustechtips']);
    });

    test('separate id and handle entries of the channel are folded into one', async () => {
        await setup({ exceptions: [LTT_ID, '@shortcircuit', '@linustechtips'], pageChannel: LTT_ID });
        await flush();

        expect(brwsr._getSyncStore().channel_exceptions).toEqual([LTT_ID + '@linustechtips', '@shortcircuit']);
    });

    test('the page channel arriving after the switch was built updates it', async () => {
        await setup({ exceptions: [LTT_ID] });
        expect(toggle().getAttribute('aria-checked')).toBe('false');
        expect(isHidden(membersCard())).toBe(true);

        tagPage('/@LinusTechTips/videos', LTT_ID);
        document.dispatchEvent(new Event('ybs-page-channel'));
        await flush();

        expect(toggle().getAttribute('aria-checked')).toBe('true');
        expect(isHidden(membersCard())).toBe(false);
        expect(brwsr._getSyncStore().channel_exceptions).toEqual([LTT_ID + '@linustechtips']);
    });

    test('a legacy /c/ page gets the switch once its channel is known', async () => {
        await setup({ path: '/c/LinusTechTips/videos', exceptions: ['@linustechtips'] });
        expect(toggle()).toBeNull();

        tagPage('/c/LinusTechTips/videos', LTT_ID);
        document.dispatchEvent(new Event('ybs-page-channel'));
        await flush();

        expect(toggle()).not.toBeNull();
        expect(toggle().getAttribute('aria-checked')).toBe('true');
        expect(isHidden(membersCard())).toBe(false);
        // before the settings button, where buildUI() puts it
        expect(toggle().nextElementSibling.nextElementSibling.id).toBe(PREFIX + 'subs-grid-menu-settings');
    });

    test('handle completion does not add back a channel removed in another tab', async () => {
        await setup({ exceptions: ['@linustechtips'] });
        // removed elsewhere; this tab hasn't heard of it yet
        brwsr._setSyncStore({ channel_exceptions: [] });

        tagPage('/@LinusTechTips/videos', LTT_ID);
        document.dispatchEvent(new Event('ybs-page-channel'));
        await flush();

        expect(brwsr._getSyncStore().channel_exceptions).toEqual([]);
    });

    test('a second click while the first is being saved is ignored', async () => {
        await setup();
        brwsr.storage.sync.set.mockClear();

        toggle().click();
        toggle().click();
        await flush();
        await flush();

        expect(brwsr.storage.sync.set).toHaveBeenCalledTimes(1);
        expect(brwsr._getSyncStore().channel_exceptions).toEqual(['@linustechtips']);
        expect(toggle().getAttribute('aria-checked')).toBe('true');
    });

    test('a failed save is shown next to the switch and announced', async () => {
        const full = Array.from({ length: 25 }, (_, i) => '@channel' + i);
        await setup({ exceptions: full });

        toggle().click();
        await flush();

        const message = document.getElementById(PREFIX + 'channel-exception-message');
        expect(message.getAttribute('aria-live')).toBe('polite');
        expect(message.getAttribute('role')).toBe('status');
        expect(toggle().nextElementSibling).toBe(message);
        expect(message.textContent).toMatch(/full/);
        expect(toggle().getAttribute('aria-checked')).toBe('false');
        expect(brwsr._getSyncStore().channel_exceptions).toEqual(full);
    });

    test('in the feed, a card hidden before pageContext.js tagged its id comes back for an id-only entry', async () => {
        await setup({ path: '/feed/subscriptions', exceptions: [LTT_ID], cardLink: '/@LinusTechTips' });
        expect(isHidden(membersCard())).toBe(true);

        Object.assign(membersCard().dataset, { ybsChannelId: LTT_ID, ybsChannelUrl: '/@LinusTechTips', ybsChannelVideo: 'memberVid01' });
        document.dispatchEvent(new Event('ybs-card-channels'));
        document.dispatchEvent(new Event('ybs-card-channels'));
        await new Promise(resolve => window.requestAnimationFrame(resolve));

        expect(isHidden(membersCard())).toBe(false);
    });

    test('in the feed, a card read without a channel (and no channel link) is not exempt', async () => {
        await setup({ path: '/feed/subscriptions', exceptions: [LTT_ID], cardLink: null });
        Object.assign(membersCard().dataset, { ybsChannelVideo: 'memberVid01' });
        global.removeWatchedAndAddButton();

        expect(isHidden(membersCard())).toBe(true);
    });

    test('in the feed, tagging a card of another channel keeps it hidden', async () => {
        await setup({ path: '/feed/subscriptions', exceptions: [LTT_ID], cardLink: '/@ShortCircuit' });

        Object.assign(membersCard().dataset, { ybsChannelId: 'UCBJycsmduvYEL83R_U4JriQ', ybsChannelUrl: '/@ShortCircuit', ybsChannelVideo: 'memberVid01' });
        document.dispatchEvent(new Event('ybs-card-channels'));
        await new Promise(resolve => window.requestAnimationFrame(resolve));

        expect(isHidden(membersCard())).toBe(true);
    });

    test('no switch on the subscriptions feed', async () => {
        await setup({ path: '/feed/subscriptions' });

        expect(toggle()).toBeNull();
    });
});
