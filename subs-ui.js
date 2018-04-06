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
    addHideWatchedCheckbox();
    addHideAllMenuButton();
}

function buildMenuButtonContainer() {
    let menuButtonContainer;
    if (newLayout) { //is new layout?
        menuButtonContainer = document.createElement("h2");
        menuButtonContainer.setAttribute("class", "style-scope ytd-shelf-renderer subs-grid-menu-item");
    } else {
        menuButtonContainer = document.createElement("li");
        menuButtonContainer.setAttribute("class", "yt-uix-menu-top-level-button yt-uix-menu-top-level-flow-button");
    }

    return menuButtonContainer;
}

function addHideAllMenuButton() {
    let hideAllButtonContainer = buildMenuButtonContainer();
    hideAllButtonContainer.setAttribute("class", "subs-grid-menu-mark-all");
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
        feed[0].insertBefore(element, feed[0].firstChild);
    } else {
        feed.insertBefore(element, feed.childNodes[0]);
    }
}

function buildButton(item, videoId) {
    let enclosingDiv = document.createElement("div");
    enclosingDiv.setAttribute("id", "metadata-line");
    enclosingDiv.setAttribute("class", "style-scope ytd-thumbnail-overlay-toggle-button-renderer");

    let button = document.createElement("button");
    button.setAttribute("id", "mark-watched");
    button.setAttribute("class", "subs-btn-mark-watched");
    button.setAttribute("role", "button");
    button.onclick = function () {
        markWatched(item, videoId, enclosingDiv);
    };

    enclosingDiv.appendChild(button);

    return enclosingDiv;
}

function removeWatchedAndAddButton() {
    let els = newLayout ? document.querySelectorAll("ytd-grid-video-renderer.style-scope.ytd-grid-renderer") : document.querySelectorAll(".feed-item-container .yt-shelf-grid-item");
    //TODO: OLD LAYOUT - still needed?

    for (item of els) {
        let stored = getVideoId(item) in storage;
        let ytWatched = isYouTubeWatched(item);

        if (stored || ytWatched) {
            hideItem(item);

            if (stored && ytWatched) {
                getStorage().remove(getVideoId(item)); //since its marked watched by YouTube, remove from storage to free space
            }
        } else {
            let dismissableDiv = item.firstChild;
            if (dismissableDiv.querySelectorAll("#mark-watched").length > 0) {
                continue;
            } else {
                dismissableDiv = dismissableDiv.firstChild;
            }

            let videoId = getVideoId(item);
            let button = buildButton(item, videoId);
            dismissableDiv.appendChild(button);
        }
    }
}