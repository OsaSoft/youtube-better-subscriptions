let isPolymer = document.getElementById("masthead-positioner") == null;
log("Polymer detected: " + isPolymer);

const PAGES = Object.freeze({
    "subscriptions": "/feed/subscriptions",
    "video": "/watch"
});

function handlePageChange(page) {
    log("Page was changed to " + page);

    //unload old page
    stopSubs();

    //handle new page
    switch (page) {
        case PAGES.subscriptions:
            initSubs();
            break;
        case PAGES.video:
            onVideoPage();
            break
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
