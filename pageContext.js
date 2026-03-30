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

    // === Init ===
    waitForGuideAndBuild();
    tagCollabRenderers();

    // Re-tag periodically (covers .data populated after DOM insertion)
    setInterval(tagCollabRenderers, 2000);

    // Observe for new video renderers
    function observeGrid() {
        const grid = document.querySelector('ytd-rich-grid-renderer');
        if (grid) {
            new MutationObserver(() => tagCollabRenderers()).observe(grid, { childList: true, subtree: true });
        } else {
            setTimeout(observeGrid, 1000);
        }
    }
    observeGrid();

    // YouTube SPA navigation
    document.addEventListener('yt-navigate-finish', () => {
        tagCollabRenderers();
        if (!document.documentElement.dataset.ytBetterSubsCache) {
            waitForGuideAndBuild();
        }
    });
})();
