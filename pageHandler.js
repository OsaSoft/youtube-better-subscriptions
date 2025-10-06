settingsLoadedCallbacks.push(initExtension);

//globally scope PAGES object so we can change behaviour based on page elsewhere
const PAGES = Object.freeze({
    "subscriptions": "/feed/subscriptions",
    "video": "/watch",
    "short": "/shorts",
    "channel": "/videos",
    "channelLive": "/streams",
    "home": ""
});

function initExtension() {

    async function handlePageChange() {
        //remove trailing /
        let page = getCurrentPage();

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
        let pageLoader = document.querySelector("yt-page-navigation-progress");

        //if the page loader element isnt ready, wait for it
        if (pageLoader == null) {
            window.requestAnimationFrame(initPageHandler);
        } else {
            log("Found page loader");

            let pageChangeObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutationRecord) => {
                    //is page fully loaded?
                    if (mutationRecord.target.attributes["aria-valuenow"].value === "100") {
                        handlePageChange();
                    }
                });
            });

            //observe when the page loader becomes visible or hidden
            pageChangeObserver.observe(pageLoader, {attributes: true, attributeFilter: ['hidden']});

            //first page doesnt trigger the event, so lets do it manually
            handlePageChange();
        }
    }

    log("Initializing...");
    initPageHandler();
}
