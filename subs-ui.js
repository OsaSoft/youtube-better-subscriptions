const HIDE_WATCHED_CHECKBOX = PREFIX + "subs-grid";
const MARK_ALL_WATCHED_BTN = PREFIX + "subs-grid-menu-mark-all";
const MARK_WATCHED_BTN = PREFIX + "mark-watched";
const MARK_UNWATCHED_BTN = PREFIX + "mark-unwatched";
const METADATA_LINE = PREFIX + "metadata-line";

let addedElems = [];

function hideItem(item) {
    hidden.push(item);
    item.style.display = 'none';
}

function changeMarkWatchedToMarkUnwatched(item) {
    // find Mark as watched button and change it to Unmark as watched
    let metaDataLine = item.querySelector("#" + METADATA_LINE);
    if (metaDataLine != null) {
        let dismissibleDiv = metaDataLine.parentNode;
        dismissibleDiv.removeChild(metaDataLine);

        let markUnwatchedBtn = buildMarkWatchedButton(item, getVideoId(item), false);
        dismissibleDiv.appendChild(markUnwatchedBtn);
    }
}

function showWatched() {
    log("Showing watched videos");

    for (let item of hidden) {
        changeMarkWatchedToMarkUnwatched(item);
        item.style.display = '';
    }
    hidden = [];
}

function buildUI() {
    log("Building subs UI");

    addHideWatchedCheckbox();
    addHideAllMenuButton();
}

function buildMenuButtonContainer() {
    let menuButtonContainer;
    if (isPolymer) { //is new layout?
        menuButtonContainer = document.createElement("h2");
        menuButtonContainer.classList.add("yt-simple-endpoint");
        menuButtonContainer.classList.add("style-scope");
        menuButtonContainer.classList.add("ytd-compact-link-renderer");
    } else {
        menuButtonContainer = document.createElement("span");
        menuButtonContainer.classList.add("yt-uix-clickcard");
    }

    menuButtonContainer.classList.add("subs-grid-menu-item");

    return menuButtonContainer;
}

function addHideAllMenuButton() {
    let hideAllButtonContainer = buildMenuButtonContainer();
    hideAllButtonContainer.classList.add("subs-grid-menu-mark-all");
    hideAllButtonContainer.setAttribute("id", MARK_ALL_WATCHED_BTN);

    hideAllButtonContainer.appendChild(document.createTextNode("Mark all as watched"));

    addElementToMenuUI(hideAllButtonContainer);

    let messenger = document.getElementById(MARK_ALL_WATCHED_BTN);
    messenger.addEventListener("click", markAllAsWatched);
}

function addHideWatchedCheckbox() {
    let subGridButtonContainer = buildMenuButtonContainer();
    subGridButtonContainer.appendChild(document.createTextNode("Hide watched")); //TODO: translations

    let subGridCheckbox = document.createElement("input");
    subGridCheckbox.setAttribute("id", HIDE_WATCHED_CHECKBOX);
    subGridCheckbox.setAttribute("type", "checkbox");
    subGridCheckbox.checked = true;

    subGridButtonContainer.appendChild(subGridCheckbox);

    addElementToMenuUI(subGridButtonContainer);

    let messenger = document.getElementById(HIDE_WATCHED_CHECKBOX);
    messenger.addEventListener("change", checkboxChange);
}

function addElementToMenuUI(element) {
    log("Adding element to menu UI");

    if (isPolymer) { //is new layout?
        let topMenuEnd = document.getElementById("end");
        if (topMenuEnd != null) { //just in case...
            topMenuEnd.parentNode.insertBefore(element, topMenuEnd);
        }
    } else {
        let uiContainer = document.getElementById("yt-masthead-user");
        if (uiContainer != null) { //just in case...
            uiContainer.insertBefore(element, uiContainer.children[0]);
        }
    }

    addedElems.push(element);
}

function buildMarkWatchedButton(item, videoId, isMarkWatchedBtn = true) {
    let enclosingDiv = document.createElement("div");
    enclosingDiv.setAttribute("id", METADATA_LINE);
    enclosingDiv.classList.add("style-scope", "ytd-thumbnail-overlay-toggle-button-renderer");

    let button = document.createElement("button");
    button.setAttribute("id", isMarkWatchedBtn ? MARK_WATCHED_BTN : MARK_UNWATCHED_BTN);
    button.classList.add(isMarkWatchedBtn ? "subs-btn-mark-watched" : "subs-btn-mark-unwatched");
    button.setAttribute("role", "button");
    if (isMarkWatchedBtn) {
        button.onclick = () => {
            markWatched(item, videoId, enclosingDiv);
        };
    } else {
        button.onclick = () => {
            markUnwatched(videoId);
            let metaDataElem = item.querySelector("#" + METADATA_LINE);
            let container = metaDataElem.parentNode;
            container.removeChild(metaDataElem);
            container.appendChild(buildMarkWatchedButton(item, videoId));
        }
    }

    enclosingDiv.appendChild(button);

    return enclosingDiv;
}

function removeWatchedAndAddButton() {
    log("Removing watched from feed and adding overlay");

    let els = isPolymer ? document.querySelectorAll("ytd-grid-video-renderer.style-scope.ytd-grid-renderer") : document.querySelectorAll(".feed-item-container .yt-shelf-grid-item");

    let hiddenCount = 0;

    for (let item of els) {
        let stored = getVideoId(item) in storage;
        let ytWatched = isYouTubeWatched(item);

        if (stored || ytWatched) {
            hideItem(item);
            hiddenCount++;

            if (stored && ytWatched) {
                markUnwatched(getVideoId(item)); //since its marked watched by YouTube, remove from storage to free space
            }
        } else {
            let dismissableDiv = item.firstChild;

            // does it already have the "Mark as Watched" button?
            if (dismissableDiv.querySelector("#" + MARK_WATCHED_BTN) != null) {
                continue;
            } else {
                dismissableDiv = dismissableDiv.firstChild;

                if (!isPolymer) {
                    dismissableDiv = dismissableDiv.firstChild;
                }
            }

            let markAsWatchedButton = buildMarkWatchedButton(item, getVideoId(item));
            dismissableDiv.appendChild(markAsWatchedButton);
        }
    }
    log("Removing watched from feed and adding overlay... Done");

    // if needed, triggers more videos to be loaded in feed
    loadMoreVideos();
}

function removeUI() {
    addedElems.forEach((elem) => {
        elem.parentNode.removeChild(elem);
    });

    addedElems = [];
}
