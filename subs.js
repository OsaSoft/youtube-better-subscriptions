let storage = {};
let hidden = [];
let hideWatched = null;
let intervalId = null;


function markWatched(item, videoId) {
    changeMarkWatchedToMarkUnwatched(item);

    if (hideWatched) {
        hideItem(item);
        processSections();
    }

    setVideoInStorage(videoId);
}

function markUnwatched(videoId) {
    getStorage().remove(videoId);
}

function hideWatchedChanged(event) {
    try {
        let toggle = document.getElementById(HIDE_WATCHED_TOGGLE);
        log("Hide Watched checkbox was changed. New value is: " + !hideWatched);

        if (hideWatched) {
            hideWatched = false;
            toggle.classList.remove("subs-btn-hide-watched-checked");
            toggle.classList.add("subs-btn-hide-watched-unchecked");
            showWatched();
        } else {
            hideWatched = true;
            toggle.classList.remove("subs-btn-hide-watched-unchecked");
            toggle.classList.add("subs-btn-hide-watched-checked");
            removeWatchedAndAddButton();
        }
    } catch (e) {
        logError(e);
    }
}

function collapseSectionChanged(event) {
    try {
        let checkbox = event.target;
        log("Checkbox for section " + checkbox.getAttribute("id") + " changed. New value is: " + checkbox.checked);

        let contentDiv = checkbox.closest(sectionDismissableQuery()).querySelector(sectionContentsQuery());
        if (checkbox.checked) {
            contentDiv.style.display = '';
        } else {
            contentDiv.style.display = 'none';
            loadMoreVideos();
        }
    } catch (e) {
        logError(e);
    }
}

function markAllAsWatched() {
    let els = document.querySelectorAll(vidQuery());

    for (let item of els) {
        markWatched(item, getVideoId(item));
    }

    loadMoreVideos();
}

function loadMoreVideos() {
    if (isPolymer) {
        log("Loading more videos");

        // workaround to load more videos, slightly scroll in the sidebar :)
        let sidebar = document.getElementById("guide-inner-content");
        let top = sidebar.scrollTop;
        // +1 -1 so the scroll moves a bit even if its at complete bottom or top
        sidebar.scrollTop += 1;
        sidebar.scrollTop -= 1;
        // move it back to original position
        sidebar.scrollTop = top;
    }
}

function getVideoIdFromUrl(url) {
    return url.split("=")[1].split("&")[0];
}

function getVideoId(item) {
    return getVideoIdFromUrl(item.querySelectorAll("a")[0].getAttribute("href"));
}

function storageChangeCallback(changes, area) {
    if (area === "local") {
        for (let key in changes) {
            let newValue = changes[key].newValue;
            if (newValue != null) { // is new added
                storage[key] = newValue;
            } else { // is removed
                delete storage[key];
            }
        }
    }
}

function initSubs() {
    log("Initializing subs page...");

    loadStorage().then(function (items) {
        storage = items;

        if (hideWatched == null || !settings["settings.hide.watched.keep.state"]) {
            hideWatched = settings["settings.hide.watched.default"];
        }

        buildUI();

        brwsr.storage.onChanged.addListener(storageChangeCallback);

        intervalId = window.setInterval(function () {
            if (hideWatched) {
                try {
                    removeWatchedAndAddButton();
                } catch (e) {
                    logError(e);
                }
            }
        }, settings["settings.hide.watched.refresh.rate"]);

        removeWatchedAndAddButton();

    });
    log("Initializing subs page... DONE");
}

function stopSubs() {
    log("Stopping subs page behaviour");

    removeUI();
    brwsr.storage.onChanged.removeListener(storageChangeCallback);
    window.clearInterval(intervalId);
}
