function handlePageChange(url) {
    switch (url) {
    }
}

function initPageHandler() {
    let pageLoader = document.querySelector("yt-page-navigation-progress");

    //if the page loader element isnt ready, wait for it
    if (pageLoader == null) {
        window.requestAnimationFrame(initPageHandler);
    } else {
        let pageChangeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutationRecord) => {
                //is page fully loaded?
                if (mutationRecord.target.attributes["aria-valuenow"].value === "100") {
                    handlePageChange(window.location.href);
                }
            });
        });

        //observe when the page loader becomes visible or hidden
        pageChangeObserver.observe(pageLoader, {attributes: true, attributeFilter: ['hidden']});

        //first page doesnt trigger the event, so lets do it manually
        handlePageChange(window.location.pathname);
    }
}

initPageHandler();
