const DELAY_MILLIS = 3000; //TODO: configurable?

let storage = {};
let hidden = [];
let hideWatched = true;
let intervalId = null;

function isYouTubeWatched(item) {
    return (
            (!isPolymer &&
                    (item.getElementsByClassName("watched").length > 0 ||
                            item.getElementsByClassName("contains-percent-duration-watched").length > 0)) || //has "WATCHED" on thumbnail
            (isPolymer &&
                    (item.querySelectorAll("yt-formatted-string.style-scope.ytd-thumbnail-overlay-playback-status-renderer").length > 0 || //has "WATCHED" on thumbnail
                            item.querySelectorAll("#progress.style-scope.ytd-thumbnail-overlay-resume-playback-renderer").length > 0) || //has progress bar on thumbnail
                    item.hasAttribute("is-dismissed")) //also hide empty blocks left in by pressing "HIDE" button
    )
}

function markWatched(item, videoId, button) {
    if (hideWatched) {
        hideItem(item);
    }

    if (button != null) {
        button.remove();
    }

    setVideoInStorage(videoId);
}

function markUnwatched(videoId) {
    getStorage().remove(videoId);
}

function checkboxChange() {
    let checkbox = document.getElementById(HIDE_WATCHED_CHECKBOX);
    if (checkbox.checked) {
        hideWatched = true;
        removeWatchedAndAddButton();
    } else {
        hideWatched = false;
        showWatched();
    }
}

function markAllAsWatched() {
    let els = isPolymer ? document.querySelectorAll("ytd-grid-video-renderer.style-scope.ytd-grid-renderer") : document.querySelectorAll(".feed-item-container .yt-shelf-grid-item");

    for (let item of els) {
        markWatched(item, getVideoId(item), null);
    }

    loadMoreVideos();
}

function loadMoreVideos() {
    if (isPolymer) {
        log("Loading more videos");

        //TODO: use injection to hang a listener on Polymer vid loading to automatically hide new vids?
        //trigger the loading of more videos
        let loadVidsScript = 'document.querySelector("yt-next-continuation").trigger();';
        //since we need to call a function on a Polymer object on page, we need to inject script
        injectScript(loadVidsScript);
    }
}

function getVideoIdFromUrl(url) {
    return url.split("=")[1].split("&")[0];
}

function getVideoId(item) {
    return getVideoIdFromUrl(item.querySelectorAll("a")[0].getAttribute("href"));
}

function storageChangeCallback(changes, area) {
    for (let key in changes) {
        let newValue = changes[key].newValue;
        if (newValue != null) { // is new added
            storage[key] = newValue;
        } else { // is removed
            delete storage[key];
        }
    }
}

function initSubs() {
    log("Initializing subs page...");

    getStorage().get(null, items => { //fill our map with watched videos
        storage = items;
    });

    buildUI();

    brwsr.storage.onChanged.addListener(storageChangeCallback);

    intervalId = window.setInterval(function () {
        if (document.getElementById(HIDE_WATCHED_CHECKBOX).checked) {
            removeWatchedAndAddButton();
        }
    }, DELAY_MILLIS);

    removeWatchedAndAddButton();

    log("Initializing subs page... DONE");
}

function stopSubs() {
    log("Stopping subs page behaviour");

    removeUI();
    brwsr.storage.onChanged.removeListener(storageChangeCallback);
    window.clearInterval(intervalId);
}
