const HIDE_WATCHED_TOGGLE = PREFIX + "hide-watched-toggle";
const HIDE_WATCHED_LABEL = PREFIX + "hide-watched-toggle-label";
const MARK_ALL_WATCHED_BTN = PREFIX + "subs-grid-menu-mark-all";
const SETTINGS_BTN = PREFIX + "subs-grid-menu-settings";
const MARK_WATCHED_BTN = PREFIX + "mark-watched";
const MARK_UNWATCHED_BTN = PREFIX + "mark-unwatched";
const METADATA_LINE = PREFIX + "metadata-line";
const COLLAPSE_SECTION_CHECKBOX = PREFIX + "collapse-section";

const HIDDEN_CLASS = PREFIX + "hidden";
const COLLAPSE_CLASS = PREFIX + "collapse-section";

let addedElems = [];

function hideItem(item) {
    hidden.push(item);
    item.style.display = 'none';
    item.classList.add(HIDDEN_CLASS);
}

function changeMarkWatchedToMarkUnwatched(item) {
    // find Mark as watched button and change it to Unmark as watched
    let metaDataLine = item.querySelector("#" + METADATA_LINE);
    if (metaDataLine != null) {
        let dismissibleDiv = metaDataLine.parentNode;
        dismissibleDiv.removeChild(metaDataLine);

        let markUnwatchedBtn = buildMarkWatchedButton(dismissibleDiv, item, getVideoId(item), false);
        dismissibleDiv.appendChild(markUnwatchedBtn);
    }
}

function showWatched() {
    log("Showing watched videos");

    for (let item of hidden) {
        item.style.display = '';
        item.classList.remove(HIDDEN_CLASS);
    }
    hidden = [];

    processSections();
}

function buildUI() {
    log("Building subs UI");

    addHideWatchedCheckbox();
    addHideAllMenuButton();
    addSettingsButton();

    if (settings["settings.hide.watched.ui.stick.right"])
        addedElems[0].after(...addedElems)
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

function addSettingsButton() {
    let settingsButton = buildMenuButtonContainer();
    settingsButton.classList.add("subs-btn-settings");
    settingsButton.setAttribute("id", SETTINGS_BTN);

    addElementToMenuUI(settingsButton);

    let messenger = document.getElementById(SETTINGS_BTN);
    messenger.addEventListener("click", () => brwsr.runtime.sendMessage({"action": "openOptionsPage"}));
}

function addHideAllMenuButton() {
    if (settings["settings.hide.watched.all.label"]) {
        let hideAllButtonContainer = buildMenuButtonContainer();
        hideAllButtonContainer.classList.add("subs-grid-menu-mark-all");
        hideAllButtonContainer.setAttribute("id", MARK_ALL_WATCHED_BTN);

        hideAllButtonContainer.appendChild(document.createTextNode("Mark all as watched"));

        addElementToMenuUI(hideAllButtonContainer);

        let messenger = document.getElementById(MARK_ALL_WATCHED_BTN);
        messenger.addEventListener("click", markAllAsWatched);
    }
}

function addHideWatchedCheckbox() {
    if (settings["settings.hide.watched.label"]) {
        let hideWatchedLabel = buildMenuButtonContainer();
        hideWatchedLabel.setAttribute("id", HIDE_WATCHED_LABEL);
        hideWatchedLabel.appendChild(document.createTextNode("Hide watched")); //TODO: translations
        addElementToMenuUI(hideWatchedLabel);

        let messenger = document.getElementById(HIDE_WATCHED_LABEL);
        messenger.addEventListener("click", hideWatchedChanged);
    }

    let toggleContainer = document.createElement("div");
    toggleContainer.setAttribute("id", HIDE_WATCHED_TOGGLE);
    toggleContainer.classList.add("toggle-container", "style-scope", "paper-toggle-button");
    if (hideWatched) {
        toggleContainer.classList.add("subs-btn-hide-watched-checked");
    } else {
        toggleContainer.classList.add("subs-btn-hide-watched-unchecked");
    }

    let toggleBar = document.createElement("div");
    toggleBar.classList.add("toggle-bar", "style-scope", "paper-toggle-button");
    let toggleButton = document.createElement("div");
    toggleButton.classList.add("toggle-button", "style-scope", "paper-toggle-button");

    toggleContainer.appendChild(toggleBar);
    toggleContainer.appendChild(toggleButton);

    addElementToMenuUI(toggleContainer);

    let messenger = document.getElementById(HIDE_WATCHED_TOGGLE);
    messenger.addEventListener("click", hideWatchedChanged);
}

function addElementToMenuUI(element) {
    log("Adding element to menu UI");

    if (isPolymer) { //is new layout?
        let topMenuEnd = document.getElementById("end");
        if (topMenuEnd != null) { //just in case...
            if (settings["settings.hide.watched.ui.stick.right"])
                topMenuEnd.prepend(element);
            else
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

function buildMarkWatchedButton(dismissibleDiv, item, videoId, isMarkWatchedBtn = true) {
    let enclosingDiv = document.createElement("div");
    enclosingDiv.setAttribute("id", METADATA_LINE);
    enclosingDiv.classList.add("style-scope", "ytd-thumbnail-overlay-toggle-button-renderer");

    let button = document.createElement("button");
    button.setAttribute("id", isMarkWatchedBtn ? MARK_WATCHED_BTN : MARK_UNWATCHED_BTN);
    button.classList.add(isMarkWatchedBtn ? "subs-btn-mark-watched" : "subs-btn-mark-unwatched");
    button.setAttribute("role", "button");
    if (isMarkWatchedBtn) {
        button.onclick = () => {
            markWatched(item, videoId);
        };
    } else {
        button.onclick = () => {
            markUnwatched(videoId);
            let metaDataElem = item.querySelector("#" + METADATA_LINE);
            let container = metaDataElem.parentNode;
            container.removeChild(metaDataElem);
            container.appendChild(buildMarkWatchedButton(dismissibleDiv, item, videoId));
        }
    }

    enclosingDiv.appendChild(button);

    if (isMarkWatchedBtn)
        dismissibleDiv.classList.remove("semitransparent");
    else
        dismissibleDiv.classList.add("semitransparent");

    return enclosingDiv;
}

let collapsibleIdNum = 0;

function addCollapsibleBtnToSection(sectionHeader) {
    try {
        // only add if doesnt have it already
        if (sectionHeader.parentNode.querySelector("." + COLLAPSE_CLASS) == null) {

            let collapsibleId = COLLAPSE_SECTION_CHECKBOX + collapsibleIdNum++;

            let collapseCheckbox = document.createElement("input");
            collapseCheckbox.setAttribute("id", collapsibleId);
            collapseCheckbox.setAttribute("type", "checkbox");
            collapseCheckbox.checked = true;
            collapseCheckbox.classList.add(COLLAPSE_CLASS);

            sectionHeader.parentNode.appendChild(collapseCheckbox);

            let messenger = document.getElementById(collapsibleId);
            messenger.addEventListener("change", collapseSectionChanged);
        }
    } catch (e) {
        logError(e);
    }
}

function processSections() {
    log("Processing sections");

    let sections = document.querySelectorAll(sectionsQuery());
    log("Found " + sections.length + " sections.");

    for (let section of sections) {
        let sectionHeader = section.querySelector(sectionTitleQuery());
        // Temporary fix for PAGES.channel TODO: refactor this (when more pages added)
        if (!sectionHeader) break;
        let sectionTitle = sectionHeader.textContent;

        // add collapse button to sections
        addCollapsibleBtnToSection(sectionHeader);

        // hide or show sections
        if (section.querySelector(vidQuery()) == null) {
            // section has no videos that arent hidden, so hide it
            if (!section.classList.contains(HIDDEN_CLASS)) {
                log("Hiding section '" + sectionTitle + "'");
                section.style.display = 'none';
                section.classList.add(HIDDEN_CLASS);
            }
        } else {
            // section has some videos that arent hidden, in case we hid it before, show it now
            if (section.classList.contains(HIDDEN_CLASS)) {
                log("Showing section '" + sectionTitle + "'");
                section.style.display = '';
                section.classList.remove(HIDDEN_CLASS);
            }
        }
    }
    log("Processing sections... Done");
}

function removeWatchedAndAddButton() {
    log("Removing watched from feed and adding overlay");

    let els = document.querySelectorAll(vidQuery());

    let hiddenCount = 0;

    for (let item of els) {
        let stored = getVideoId(item) in storage;
        let dismissableDiv = item.firstElementChild;
        let button = stored? MARK_UNWATCHED_BTN : MARK_WATCHED_BTN;

        if (stored && hideWatched) {
            hideItem(item);
            hiddenCount++;
        }

        // does it already have any button?
        if (dismissableDiv.querySelector("#" + button) != null) {
            continue;
        } else {
            dismissableDiv = dismissableDiv.firstChild;

            if (!isPolymer) {
                dismissableDiv = dismissableDiv.firstChild;
            }
        }

        // stored = false - build "Mark as watched"
        // stored = true  - build "Mark as unwatched"
        let markButton = buildMarkWatchedButton(dismissableDiv, item, getVideoId(item), !stored);
        dismissableDiv.appendChild(markButton);
    }
    log("Removing watched from feed and adding overlay... Done");

    // if we hid any videos, see if sections need changing, or videos loading
    if (hiddenCount > 0) {
        processSections();
        loadMoreVideos();
    }
}

function removeUI() {
    addedElems.forEach((elem) => {
        elem.parentNode.removeChild(elem);
    });

    addedElems = [];

    // delete built buttons
    document.querySelectorAll("#" + METADATA_LINE).forEach(e => e.remove());

    // make hidden videos visible
    for (let item of hidden) {
        item.style.display = '';
        item.classList.remove(HIDDEN_CLASS);
    }
    hidden = [];
}
