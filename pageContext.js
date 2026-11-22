// This script runs in the PAGE context (not content script isolated world).
// It can access Polymer .data properties on YouTube's custom elements.
// Results are stored as data-* attributes on DOM elements for the content script to read.

(function() {
    // === Subscription cache ===
    function scrapeGuideEntries() {
        const ids = [];
        document.querySelectorAll('ytd-guide-entry-renderer').forEach(entry => {
            try {
                const browseId = entry.data?.navigationEndpoint?.browseEndpoint?.browseId;
                if (browseId && browseId.startsWith('UC')) ids.push(browseId);
            } catch (e) {}
        });
        return ids;
    }

    function findExpandButton(iconType) {
        for (const entry of document.querySelectorAll('ytd-guide-entry-renderer')) {
            try {
                if (entry.data?.icon?.iconType === iconType) {
                    const section = entry.closest('ytd-guide-section-renderer');
                    const hasChannels = section && Array.from(
                        section.querySelectorAll('ytd-guide-entry-renderer')
                    ).some(e => {
                        const id = e.data?.navigationEndpoint?.browseEndpoint?.browseId;
                        return id && id.startsWith('UC');
                    });
                    if (hasChannels) return entry;
                }
            } catch (e) {}
        }
        return null;
    }

    function waitForPopulatedEntries(minExpected, maxAttempts, intervalMs) {
        return new Promise(resolve => {
            let attempts = 0;
            function check() {
                const ids = scrapeGuideEntries();
                attempts++;
                if (ids.length >= minExpected || attempts >= maxAttempts) {
                    resolve(ids);
                } else {
                    setTimeout(check, intervalMs);
                }
            }
            check();
        });
    }

    async function buildAndStoreSubscriptionCache() {
        let ids = scrapeGuideEntries();

        const showMoreBtn = findExpandButton('EXPAND_CAIRO');
        if (showMoreBtn) {
            showMoreBtn.click();
            const initialCount = ids.length;
            ids = await waitForPopulatedEntries(initialCount + 1, 20, 250);
            const showFewerBtn = findExpandButton('COLLAPSE_CAIRO');
            if (showFewerBtn) showFewerBtn.click();
        }

        document.documentElement.dataset.ytBetterSubsCache = JSON.stringify(ids);
    }

    // === Collab video poster tagging ===
    function tagCollabRenderers() {
        document.querySelectorAll('ytd-rich-item-renderer').forEach(renderer => {
            if (renderer.dataset.posterChannelId) return;
            try {
                const data = renderer.data;
                if (!data) return;
                const listItems = data.content?.lockupViewModel?.metadata
                    ?.lockupMetadataViewModel?.image?.avatarStackViewModel
                    ?.rendererContext?.commandContext?.onTap?.innertubeCommand
                    ?.showDialogCommand?.panelLoadingStrategy?.inlineContent
                    ?.dialogViewModel?.customContent?.listViewModel?.listItems;
                if (listItems && listItems.length > 0) {
                    const posterId = listItems[0]?.listItemViewModel
                        ?.rendererContext?.commandContext?.onTap?.innertubeCommand
                        ?.browseEndpoint?.browseId;
                    if (posterId) {
                        renderer.dataset.posterChannelId = posterId;
                    }
                }
            } catch (e) {}
        });
    }

    // === Channel tagging for the channel exceptions (#280) ===
    // Each lockup card gets the channel it belongs to (for a collab, the uploader) as
    // data-ybs-channel-id (browseId) and data-ybs-channel-url ("/@handle"), stamped with the video
    // it was read for in data-ybs-channel-video: YouTube may reuse a renderer for another video.
    const HANDLE_IN_TEXT = /@([\p{L}\p{M}\p{N}_.\-\u00B7]{3,30})/u;

    function channelUrlFrom(endpoint, text) {
        const base = endpoint?.canonicalBaseUrl;
        if (typeof base === 'string' && base.startsWith('/@')) return base;
        // a collab's list items have no canonicalBaseUrl, only "@handle • 1.2m subscribers"
        const match = typeof text === 'string' ? text.match(HANDLE_IN_TEXT) : null;
        return match ? '/@' + match[1] : null;
    }

    // The first browseEndpoint of a channel (browseId "UC…") in a part of the card's data
    function findChannelEndpoint(node, depth) {
        if (!node || typeof node !== 'object' || depth > 30) return null;
        const endpoint = node.browseEndpoint;
        if (endpoint && typeof endpoint.browseId === 'string' && endpoint.browseId.startsWith('UC')) {
            return endpoint;
        }
        for (const key in node) {
            const found = findChannelEndpoint(node[key], depth + 1);
            if (found) return found;
        }
        return null;
    }

    function readCardChannel(lockup) {
        const metadata = lockup.metadata?.lockupMetadataViewModel;
        if (!metadata) return null;
        const avatarStack = metadata.image?.avatarStackViewModel;
        if (avatarStack) {
            // collab: the uploader is the first channel of the dialog the avatar stack opens
            const item = avatarStack.rendererContext?.commandContext?.onTap?.innertubeCommand
                ?.showDialogCommand?.panelLoadingStrategy?.inlineContent?.dialogViewModel
                ?.customContent?.listViewModel?.listItems?.[0]?.listItemViewModel;
            const endpoint = item?.rendererContext?.commandContext?.onTap?.innertubeCommand?.browseEndpoint;
            if (!endpoint?.browseId) return null;
            return {id: endpoint.browseId, url: channelUrlFrom(endpoint, item.subtitle?.content)};
        }
        // one channel: its avatar, or the channel name in the metadata rows
        const endpoint = findChannelEndpoint(metadata.image, 0) || findChannelEndpoint(metadata.metadata, 0);
        return endpoint ? {id: endpoint.browseId, url: channelUrlFrom(endpoint, null)} : null;
    }

    // the video each renderer was last read for, so one whose data names no channel isn't walked again
    const cardChannelRead = new WeakMap();

    function tagCardChannels() {
        let tagged = false;
        document.querySelectorAll('ytd-rich-item-renderer').forEach(renderer => {
            try {
                const lockup = renderer.data?.content?.lockupViewModel;
                const videoId = lockup?.contentId;
                if (!videoId || cardChannelRead.get(renderer) === videoId) return;
                cardChannelRead.set(renderer, videoId);
                const channel = readCardChannel(lockup);
                if (!channel) {
                    // read, but its data names no channel: the content script stops waiting for one
                    delete renderer.dataset.ybsChannelId;
                    delete renderer.dataset.ybsChannelUrl;
                    renderer.dataset.ybsChannelVideo = videoId;
                    return;
                }
                renderer.dataset.ybsChannelId = channel.id;
                if (channel.url) {
                    renderer.dataset.ybsChannelUrl = channel.url;
                } else {
                    delete renderer.dataset.ybsChannelUrl;
                }
                renderer.dataset.ybsChannelVideo = videoId;
                tagged = true;
            } catch (e) {}
        });
        // tells the content script (subs.js): cards it already scanned may now match an entry by id
        if (tagged) {
            document.dispatchEvent(new Event('ybs-card-channels'));
        }
    }

    // The channel of the current channel page, from YouTube's data for it, on <html> as
    // data-ybs-page-channel-id / -url, stamped with the path it was read for (data-ybs-page-channel-path).
    // Cleared when a navigation starts, so it never names the page being left.
    let navigating = false;
    // whether the tag for the current path came from the navigation's own response, which a read of
    // ytd-browse (maybe still showing the previous channel's data) mustn't overwrite
    let pageChannelFromNavigation = false;

    function channelMetadataOf(response) {
        return response?.metadata?.channelMetadataRenderer || null;
    }

    function writePageChannel(metadata) {
        const root = document.documentElement.dataset;
        const id = metadata?.externalId;
        if (typeof id !== 'string' || !id.startsWith('UC')) return false;
        const url = metadata.vanityChannelUrl || metadata.ownerUrls?.[0] || '';
        if (root.ybsPageChannelPath === location.pathname && root.ybsPageChannelId === id && root.ybsPageChannelUrl === url) {
            return true;
        }
        root.ybsPageChannelId = id;
        root.ybsPageChannelUrl = url;
        root.ybsPageChannelPath = location.pathname;
        // tells the content script (subs.js); events reach it, unlike the page's JS objects
        document.dispatchEvent(new Event('ybs-page-channel'));
        return true;
    }

    function clearPageChannel() {
        const root = document.documentElement.dataset;
        delete root.ybsPageChannelPath;
        delete root.ybsPageChannelId;
        delete root.ybsPageChannelUrl;
    }

    // From the visible ytd-browse (others may stay in the DOM, hidden, for pages visited before)
    function tagPageChannelFromDom() {
        if (navigating || (pageChannelFromNavigation && document.documentElement.dataset.ybsPageChannelPath === location.pathname)) return;
        for (const browse of document.querySelectorAll('ytd-browse')) {
            if (browse.hasAttribute('hidden')) continue;
            try {
                if (writePageChannel(channelMetadataOf(browse.data))) return;
            } catch (e) {}
        }
    }

    // Wait for guide entries to have .data, then build cache
    function waitForGuideAndBuild() {
        for (const entry of document.querySelectorAll('ytd-guide-entry-renderer')) {
            if (entry.data?.navigationEndpoint) {
                buildAndStoreSubscriptionCache();
                return;
            }
        }
        const guide = document.querySelector('ytd-guide-renderer #sections');
        if (guide) {
            const observer = new MutationObserver(() => {
                for (const entry of document.querySelectorAll('ytd-guide-entry-renderer')) {
                    if (entry.data?.navigationEndpoint) {
                        observer.disconnect();
                        buildAndStoreSubscriptionCache();
                        return;
                    }
                }
            });
            observer.observe(guide, { childList: true, subtree: true });
        } else {
            setTimeout(waitForGuideAndBuild, 1000);
        }
    }

    function tagRenderers() {
        tagCollabRenderers();
        tagCardChannels();
        tagPageChannelFromDom();
    }

    // The subscription cache (which opens the guide's "Show more") is built only when the collab
    // filter asks for it (subscriptionCache.js): this script is also loaded for the channel exceptions.
    let subscriptionCacheRequested = false;

    function requestSubscriptionCache() {
        if (subscriptionCacheRequested) return;
        subscriptionCacheRequested = true;
        waitForGuideAndBuild();
    }

    // === Init ===
    if (document.documentElement.dataset.ybsWantSubscriptionCache) {
        requestSubscriptionCache();
    }
    document.addEventListener('ybs-build-subscription-cache', requestSubscriptionCache);
    tagRenderers();

    // Re-tag periodically (covers .data populated after DOM insertion)
    setInterval(tagRenderers, 2000);

    // Observe for new video renderers
    function observeGrid() {
        const grid = document.querySelector('ytd-rich-grid-renderer');
        if (grid) {
            new MutationObserver(() => {
                tagCollabRenderers();
                tagCardChannels();
            }).observe(grid, { childList: true, subtree: true });
        } else {
            setTimeout(observeGrid, 1000);
        }
    }
    observeGrid();

    // YouTube SPA navigation
    let navigatingTimeout = null;
    document.addEventListener('yt-navigate-start', () => {
        navigating = true;
        pageChannelFromNavigation = false;
        clearPageChannel();
        // a navigation that never finishes doesn't stop the tagging for good
        clearTimeout(navigatingTimeout);
        navigatingTimeout = setTimeout(() => { navigating = false; }, 5000);
    });
    document.addEventListener('yt-navigate-finish', (event) => {
        navigating = false;
        clearTimeout(navigatingTimeout);
        clearPageChannel();
        try {
            pageChannelFromNavigation = writePageChannel(channelMetadataOf(event.detail?.response?.response));
        } catch (e) {
            pageChannelFromNavigation = false;
        }
        tagRenderers();
        if (subscriptionCacheRequested && !document.documentElement.dataset.ytBetterSubsCache) {
            waitForGuideAndBuild();
        }
    });
})();
