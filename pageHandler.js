settingsLoadedCallbacks.push(initExtension);

function initExtension() {
    const PAGES = Object.freeze({
        "subscriptions": "/feed/subscriptions",
        "video": "/watch",
        "short": "/shorts",
        "channel": "/videos",
        "channelLive": "/streams",
        "home": ""
    });

    let pageChangeTimeout = null;
    let lastHandledPage = null;

    // Debounced page change handler - delays processing to allow URL to update
    // during SPA navigation before we check which page we're on (fixes #180)
    function schedulePageChange() {
        clearTimeout(pageChangeTimeout);
        pageChangeTimeout = setTimeout(handlePageChange, 100);
    }

    async function handlePageChange() {
        let page = getCurrentPage();

        // Skip if page hasn't actually changed (avoids duplicate processing)
        if (page === lastHandledPage) {
            log("Page change event fired but URL unchanged, skipping: " + page);
            return;
        }
        lastHandledPage = page;

        log("Page was changed to " + page);

        //unload old page
        stopSubs();

        try {
            //handle new page
            switch (page) {
                case PAGES.subscriptions:
                    await initSubs();
                    break;
                case PAGES.video:
                    onVideoPage();
                    break
                case PAGES.home:
                    if (settings["settings.hide.watched.support.home"]) initSubs();
                    break;
                default:
                    if (page.includes(PAGES.short)) {
                        onShortPage();
                    } else if ((page.includes(PAGES.channel) || page.includes(PAGES.channelLive)) && settings["settings.hide.watched.support.channel"]) {
                        await initSubs();
                    }
            }
        } catch (e) {
            logError(e)
        }
    }

    function initPageHandler() {
        // Method 1: Try the old progress bar element (for old layout)
        let pageLoader = document.querySelector("yt-page-navigation-progress");

        if (pageLoader != null) {
            // Old layout - use existing MutationObserver approach
            log("Found page loader (old layout)");

            let pageChangeObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutationRecord) => {
                    //is page fully loaded?
                    if (mutationRecord.target.attributes["aria-valuenow"].value === "100") {
                        schedulePageChange();
                    }
                });
            });

            //observe when the page loader becomes visible or hidden
            pageChangeObserver.observe(pageLoader, {attributes: true, attributeFilter: ['hidden']});
        } else {
            // Method 2: New layout - use yt-navigate-finish event
            log("Using yt-navigate-finish event (new layout)");
            document.addEventListener('yt-navigate-finish', schedulePageChange);
        }

        // Handle initial page load regardless of method
        handlePageChange();
    }

    log("Initializing...");
    initPageHandler();
}
