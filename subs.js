const delayMilisecs = 3000; //TODO: configurable?

let storage = {};
let hidden = [];
let hideWatched = true;
const newLayout = document.querySelectorAll(".feed-item-container .yt-shelf-grid-item").length == 0; //is it the new (~fall 2017) YT layout?

function isYouTubeWatched(item) {
    return (
        (!newLayout &&
            (item.getElementsByClassName("watched").length > 0 ||
                item.getElementsByClassName("contains-percent-duration-watched").length > 0)) || //has "WATCHED" on thumbnail
        (newLayout &&
            (item.querySelectorAll("yt-formatted-string.style-scope.ytd-thumbnail-overlay-playback-status-renderer").length > 0 || //has "WATCHED" on thumbnail
                item.querySelectorAll("#progress.style-scope.ytd-thumbnail-overlay-resume-playback-renderer").length > 0) || //has progress bar on thumbnail
            item.hasAttribute("is-dismissed")) //also hide empty blocks left in by pressing "HIDE" button
    )
}

function markWatched(item, videoId, button) {
    if (hideWatched) {
        hideItem(item);
    }

    button.remove();

    let obj = {};
    obj[videoId] = Date.now();
    getStorage().set(obj);
}

function checkboxChange() {
    let checkbox = document.getElementById("subs-grid");
    if (checkbox.checked) {
        hideWatched = true;
        removeWatchedAndAddButton();
    } else {
        hideWatched = false;
        showWatched();
    }
}

function markAllAsWatched() {
    window.alert("Pressed it!");
}

function getVideoIdFromUrl(url) {
    return url.split("=")[1].split("&")[0];
}

function getVideoId(item) {
    return getVideoIdFromUrl(item.querySelectorAll("a")[0].getAttribute("href"));
}

function storageChangeCallback(changes, area) {
    for (key in changes) {
        storage[key] = changes[key].newValue;
    }
}

getStorage().get(null, function (items) { //fill our map with watched videos
    storage = items;
});

buildUI();

brwsr.storage.onChanged.addListener(storageChangeCallback);

let intervalID = window.setInterval(function () {
    if (document.getElementById("subs-grid").checked) {
        removeWatchedAndAddButton();
    }
}, delayMilisecs);
