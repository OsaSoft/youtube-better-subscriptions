let addedElems = [];

function hideItem(item) {
    hidden.push(item);
    item.style.display = 'none';
}

function showWatched() {
    for (it of hidden) {
        it.style.display = '';
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
    hideAllButtonContainer.setAttribute("id", "subs-grid-menu-mark-all");

    hideAllButtonContainer.appendChild(document.createTextNode("Mark all as watched"));

    addElementToMenuUI(hideAllButtonContainer);

    let messenger = document.getElementById("subs-grid-menu-mark-all");
    messenger.addEventListener("click", markAllAsWatched);
}

function addHideWatchedCheckbox() {
    let subGridButtonContainer = buildMenuButtonContainer();
    subGridButtonContainer.appendChild(document.createTextNode("Hide watched")); //TODO: translations

    let subGridCheckbox = document.createElement("input");
    subGridCheckbox.setAttribute("id", "subs-grid");
    subGridCheckbox.setAttribute("type", "checkbox");
    subGridCheckbox.checked = true;

    subGridButtonContainer.appendChild(subGridCheckbox);

    addElementToMenuUI(subGridButtonContainer);

    let messenger = document.getElementById("subs-grid");
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

function buildButton(item, videoId) {
    let enclosingDiv = document.createElement("div");
    enclosingDiv.setAttribute("id", "metadata-line");
    enclosingDiv.classList.add("style-scope");
    enclosingDiv.classList.add("ytd-thumbnail-overlay-toggle-button-renderer");

    let button = document.createElement("button");
    button.setAttribute("id", "mark-watched");
    button.classList.add("subs-btn-mark-watched");
    button.setAttribute("role", "button");
    button.onclick = function () {
        markWatched(item, videoId, enclosingDiv);
    };

    enclosingDiv.appendChild(button);

    return enclosingDiv;
}

function removeWatchedAndAddButton() {
    log("Removing watched from feed and adding overlay");

    let els = isPolymer ? document.querySelectorAll("ytd-grid-video-renderer.style-scope.ytd-grid-renderer") : document.querySelectorAll(".feed-item-container .yt-shelf-grid-item");

    let hiddenCount = 0;

    for (item of els) {
        let stored = getVideoId(item) in storage;
        let ytWatched = isYouTubeWatched(item);

        if (stored || ytWatched) {
            hideItem(item);
            hiddenCount++;

            if (stored && ytWatched) {
                getStorage().remove(getVideoId(item)); //since its marked watched by YouTube, remove from storage to free space
            }
        } else {
            let dismissableDiv = item.firstChild;
            if (dismissableDiv.querySelectorAll("#mark-watched").length > 0) {
                continue;
            } else {
                dismissableDiv = dismissableDiv.firstChild;

                if (!isPolymer) {
                    dismissableDiv = dismissableDiv.firstChild;
                }
            }

            let videoId = getVideoId(item);
            let button = buildButton(item, videoId);
            dismissableDiv.appendChild(button);
        }
    }

    //have all vids been hidden?
    if (hiddenCount === els.length) {
        loadMoreVideos();
    }
}

function removeUI() {
    addedElems.forEach((elem) => {
        elem.parentNode.removeChild(elem);
    });

    addedElems = [];
}
