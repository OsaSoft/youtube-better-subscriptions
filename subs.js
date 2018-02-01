const delaySeconds = 3000; //TODO: configurable?
let hidden = [];
const newLayout = document.querySelectorAll(".feed-item-container .yt-shelf-grid-item").length == 0; //is it the new (~fall 2017) YT layout?

function isWatched(item) {
    return (!newLayout &&
        (item.getElementsByClassName("watched").length > 0 ||
            item.getElementsByClassName("contains-percent-duration-watched").length > 0)) || //has "WATCHED" on thumbnail
        (newLayout &&
            (item.querySelectorAll("yt-formatted-string.style-scope.ytd-thumbnail-overlay-playback-status-renderer").length > 0 || //has "WATCHED" on thumbnail
                item.querySelectorAll("#progress.style-scope.ytd-thumbnail-overlay-resume-playback-renderer").length > 0) || //has progress bar on thumbnail
            item.hasAttribute("is-dismissed")) //also hide empty blocks left in by pressing "HIDE" button
}

function removeWatched() {
    let els = newLayout ? document.querySelectorAll("ytd-grid-video-renderer.style-scope.ytd-grid-renderer") : document.querySelectorAll(".feed-item-container .yt-shelf-grid-item");

    for (item of els) {
        if (isWatched(item)) {
            hidden.push(item);
            item.style.display = 'none';
        }
    }
}

function showWatched() {
    for (it of hidden) {
        it.style.display = '';
    }
    hidden = [];
}

function checkboxChange() {
    let checkbox = document.getElementById("subs-grid");
    if (checkbox.checked) {
        removeWatched();
    } else {
        showWatched();
    }
}

function addHideWatchedCheckbox() {
    let subGridButtonContainer;
    if (newLayout) { //is new layout?
        subGridButtonContainer = document.createElement("h2");
        subGridButtonContainer.setAttribute("class", "style-scope ytd-shelf-renderer");
    } else {
        subGridButtonContainer = document.createElement("li");
        subGridButtonContainer.setAttribute("class", "yt-uix-menu-top-level-button yt-uix-menu-top-level-flow-button");
    }

    subGridButtonContainer.appendChild(document.createTextNode("Hide watched")); //TODO: translations

    let subGridCheckbox = document.createElement("input");
    subGridCheckbox.setAttribute("id", "subs-grid");
    subGridCheckbox.setAttribute("type", "checkbox");
    subGridCheckbox.checked = true;

    subGridButtonContainer.appendChild(subGridCheckbox);

    let feed;
    if (newLayout) { //is new layout?
        let buttonMenu = document.querySelectorAll("#title-container #menu");
        if (buttonMenu) {
            buttonMenu = buttonMenu[0].firstChild;
        }
        feed = buttonMenu ? buttonMenu : document.body;
    } else {
        feed = document.getElementsByClassName("yt-uix-menu-container feed-item-action-menu");
    }

    if (feed.length > 0) { //just in case
        feed[0].insertBefore(subGridButtonContainer, feed[0].firstChild);
    } else {
        feed.insertBefore(subGridButtonContainer, feed.childNodes[0]); //appendChild(subGridButtonContainer);
    }

    let messenger = document.getElementById("subs-grid");
    messenger.addEventListener("change", checkboxChange);
}

function buildButton(videoId) {
    let enclosingDiv = document.createElement("div");
    enclosingDiv.setAttribute("id", "metadata-line");
    enclosingDiv.setAttribute("class", "style-scope ytd-grid-video-renderer");

    let button = document.createElement("button");
    button.setAttribute("id", "mark-watched");
    button.setAttribute("class", "subs-btn-mark-watched");
    button.setAttribute("role", "button");

    let markWatchedText = document.createTextNode("Mark as watched"); //TODO: translations

    button.appendChild(markWatchedText);

    enclosingDiv.appendChild(button);

    return enclosingDiv;
}

function getVideoIdFromUrl(url) {
    return url.split("=")[1].split("&")[0];
}

function addMarkAsWatchedButton() {
    let els = newLayout ? document.querySelectorAll("ytd-grid-video-renderer.style-scope.ytd-grid-renderer") : document.querySelectorAll(".feed-item-container .yt-shelf-grid-item");
    //TODO: OLD LAYOUT

    for (item of els) {
        if (!isWatched(item)) {
            let dismissableDiv = item.firstChild;
            if (dismissableDiv.querySelectorAll("#mark-watched").length > 0) {
                continue;
            }

            let videoId = getVideoIdFromUrl(item.querySelectorAll("a")[0].getAttribute("href"));
            let button = buildButton(videoId);

            dismissableDiv.appendChild(button);
        }
    }
}

function storageChangeCallback (changes, area) {
    for (key in changes) {
        let storageChange = changes[key];
        console.log("Change ins area " + area + ". Key: " + key + ", Val: " + storageChange)
    }
}

addHideWatchedCheckbox();

let intervalID = window.setInterval(function () {
    if (document.getElementById("subs-grid").checked) {
        removeWatched();
        addMarkAsWatchedButton();
    }
}, delaySeconds);
