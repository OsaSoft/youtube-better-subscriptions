let isPolymer = false;

settingsLoadedCallbacks.push(initExtension);

function initExtension() {
    isPolymer = document.getElementById("masthead-positioner") == null;
    log("Polymer detected: " + isPolymer);

    const PAGES = Object.freeze({
        "subscriptions": "/feed/subscriptions",
        "video": "/watch",
        "channel": "/videos",
    });

    function handlePageChange(page) {
        //remove trailing /
        page = page.replace(/\/$/, "");

        log("Page was changed to " + page);

        //unload old page
        stopSubs();

        try {
            //handle new page
            switch (page) {
                case PAGES.subscriptions:
                    initSubs();
                    break;
                case PAGES.video:
                    onVideoPage();
                    break;
                default:
                    if (page.includes(PAGES.channel) && settings["settings.hide.watched.support.channel"])
                        initSubs();
            }
        } catch (e) {
            logError(e)
        }
    }

    function initPageHandler() {
        let pageLoader = document.querySelector("yt-page-navigation-progress");

        //if the page loader element isnt ready, wait for it
        if (pageLoader == null && isPolymer) {
            window.requestAnimationFrame(initPageHandler);
        } else {
            if (isPolymer) {
                log("Found page loader");

                let pageChangeObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutationRecord) => {
                        //is page fully loaded?
                        if (mutationRecord.target.attributes["aria-valuenow"].value === "100") {
                            handlePageChange(window.location.pathname);
                        }
                    });
                });

                //observe when the page loader becomes visible or hidden
                pageChangeObserver.observe(pageLoader, {attributes: true, attributeFilter: ['hidden']});
            }

            //first page doesnt trigger the event, so lets do it manually
            handlePageChange(window.location.pathname);
        }
    }

    log("Initializing...");
    initPageHandler();
}
