let hidden = [];
let older = [];
let hideWatched = null;
let hidePremieres = null;
let hideShorts = null;
let intervalId = null;
let hideOlder = null;
let hideOlderCutoff = null;

function isYouTubeWatched(item) {
    let ytWatchedPercentThreshold = settings["settings.mark.watched.youtube.watched"];
    return ytWatchedPercentThreshold === true && (
            (item.querySelectorAll("yt-formatted-string.style-scope.ytd-thumbnail-overlay-playback-status-renderer").length > 0 || //has "WATCHED" on thumbnail
                    item.querySelectorAll("#progress.style-scope.ytd-thumbnail-overlay-resume-playback-renderer").length > 0 || //has progress bar on thumbnail TODO allow percentage threshold
                    item.querySelectorAll(".ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment").length > 0) || // new YT layout as of 09/2025
            item.hasAttribute("is-dismissed") //also hide empty blocks left in by pressing "HIDE" button
    )
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

function hideOlderChanged(event) {
    try {
        let select = document.getElementById(HIDE_OLDER_CUTOFF_SELECT);
        hideOlderCutoff = select.value;
        showOlder();
        removeWatchedAndAddButton();
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
        new SubscriptionVideo(item).markWatched();
    }

    loadMoreVideos();
}

function loadMoreVideos() {
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

function getVideoTitle(item) {
    return item.querySelector("#video-title").title;
}

async function initSubs() {
    log("Initializing subs page...");

    await loadWatchedVideos();

    if (hideWatched == null || !settings["settings.hide.watched.keep.state"]) {
        hideWatched = settings["settings.hide.watched.default"];
    }
    if (hidePremieres == null) {
        hidePremieres = settings["settings.hide.premieres"];
    }
    if (hideShorts == null) {
        hideShorts = settings["settings.hide.shorts"];
    }
    if (hideOlder == null) {
        hideOlder = settings["settings.hide.older"];
    }
    if (hideOlderCutoff == null) {
        hideOlderCutoff = settings["settings.hide.older.cutoff"];
    }

    buildUI();

    intervalId = window.setInterval(function () {
        if (hideWatched || hideOlder) {
            try {
                removeWatchedAndAddButton();
            } catch (e) {
                logError(e);
            }
        }
    }, settings["settings.hide.watched.refresh.rate"]);

    removeWatchedAndAddButton();

    log("Initializing subs page... DONE");
}

function stopSubs() {
    log("Stopping subs page behaviour");

    removeUI();
    window.clearInterval(intervalId);
}
