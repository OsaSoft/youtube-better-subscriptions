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
const EMPTY_SHELF_HIDDEN_CLASS = PREFIX + "empty-shelf-hidden";

const STOP_LOADING_BTN = PREFIX + "stop-loading-older";
// set on <html> while loading is stopped; a rule in subs.css hides YouTube's continuation element under it
const STOP_LOADING_ATTR = PREFIX + "stop-loading";
// storage.local key. Must not be 11 or 12 characters long: loadWatchedVideos() reads all of
// storage.local and treats such keys as (old format) video ids.
const STOP_LOADING_KEY = "subs_stop_loading_older";
const STOP_LOADING_STYLES = ["text", "icon-text", "icon", "off"];
const STOP_LOADING_LABEL = "Stop loading older videos";
const RESUME_LOADING_LABEL = "Resume loading older videos";
const SVG_NS = "http://www.w3.org/2000/svg";
// crossed-out clock / rewind clock, drawn in currentColor so they follow the theme
const STOP_LOADING_ICON = [
    ["circle", {cx: "12", cy: "12", r: "8.5"}],
    ["path", {d: "M12 7.5V12l2.5 1.5"}],
    ["path", {d: "M4.5 4.5l15 15"}],
];
const RESUME_LOADING_ICON = [
    ["path", {d: "M3.5 12a8.5 8.5 0 1 0 2.5-6"}],
    ["path", {d: "M3 4v4h4"}],
    ["path", {d: "M12 7.5V12l3 2"}],
];

let addedElems = [];

// true from the start of a YouTube navigation (see removeControlsOnNavigateStart) until stopSubs()
// unloads the page: buildUI() and rebuildUI() must not put controls back on the page being left
let navigatingAway = false;
// whether removeControlsOnNavigateStart() took anything down, i.e. there is something to restore
// if the navigation never finishes
let removedOnNavigateStart = false;

// whether the user stopped YouTube from loading older videos on the subscriptions feed (per device)
let stopLoadingOlder = false;
let stopLoadingObservers = [];
let stopLoadingPlaceTimeout = null;

// show shelves (e.g. Shorts) that were hidden because all of their videos were hidden
function showEmptyShelves() {
    document.querySelectorAll("." + EMPTY_SHELF_HIDDEN_CLASS).forEach(section => {
        section.style.display = '';
        section.classList.remove(EMPTY_SHELF_HIDDEN_CLASS);
    });
}

function showWatched() {
    log("Showing watched videos");

    for (let item of hidden) {
        item.style.display = '';
        item.classList.remove(HIDDEN_CLASS);
    }
    hidden = [];
    showEmptyShelves();

    processSections();
}

function buildUI() {
    if (navigatingAway) {
        return;
    }
    log("Building subs UI");

    // first, so loading is stopped even if the header controls below find no place to go. Floating,
    // so kept out of addedElems (which the stick-right line below moves into the header).
    addStopLoadingButton();

    addHideWatchedCheckbox();
    addHideAllMenuButton();
    addSettingsButton();

    // empty when addElementToMenuUI() found no place for them
    if (settings["settings.hide.watched.ui.stick.right"] && addedElems.length > 0)
        addedElems[0].after(...addedElems)
}

function getStopLoadingStyle() {
    let style = settings["settings.stop.loading.button.style"];
    return STOP_LOADING_STYLES.includes(style) ? style : DEFAULT_SETTINGS["settings.stop.loading.button.style"];
}

// Whether YouTube is kept from loading older videos: only on the subscriptions feed, and never with
// the button turned off (a stored "stopped" state is then ignored, so loading can't get stuck).
function isLoadingOlderStopped() {
    return stopLoadingOlder && getStopLoadingStyle() !== "off" && isSubscriptionsPage();
}

async function loadStopLoadingOlder() {
    if (!isSubscriptionsPage()) {
        stopLoadingOlder = false;
        return;
    }
    let items = await new Promise(resolve => brwsr.storage.local.get(STOP_LOADING_KEY, resolve));
    stopLoadingOlder = (items && items[STOP_LOADING_KEY]) === true;
}

function applyStopLoadingOlder() {
    document.documentElement.toggleAttribute(STOP_LOADING_ATTR, isLoadingOlderStopped());
}

function buildSvgIcon(shapes) {
    let svg = document.createElementNS(SVG_NS, "svg");
    let attrs = {
        "viewBox": "0 0 24 24", "fill": "none", "stroke": "currentColor", "stroke-width": "2",
        "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true",
    };
    for (let name in attrs) {
        svg.setAttribute(name, attrs[name]);
    }
    for (let [tag, shapeAttrs] of shapes) {
        let shape = document.createElementNS(SVG_NS, tag);
        for (let name in shapeAttrs) {
            shape.setAttribute(name, shapeAttrs[name]);
        }
        svg.appendChild(shape);
    }
    return svg;
}

function renderStopLoadingButton(button) {
    let style = getStopLoadingStyle();
    let stopped = isLoadingOlderStopped();
    let label = stopped ? RESUME_LOADING_LABEL : STOP_LOADING_LABEL;

    button.setAttribute("data-state", stopped ? "stopped" : "loading");
    button.setAttribute("data-style", style);
    button.setAttribute("title", label);
    button.setAttribute("aria-label", label);
    button.replaceChildren();
    if (style !== "text") {
        button.appendChild(buildSvgIcon(stopped ? RESUME_LOADING_ICON : STOP_LOADING_ICON));
    }
    if (style !== "icon") {
        let text = document.createElement("span");
        text.textContent = label;
        button.appendChild(text);
    }
}

function stopLoadingOlderClicked() {
    try {
        stopLoadingOlder = !isLoadingOlderStopped();
        log("Loading older videos " + (stopLoadingOlder ? "stopped" : "resumed"));
        brwsr.storage.local.set({[STOP_LOADING_KEY]: stopLoadingOlder});
        applyStopLoadingOlder();
        let button = document.getElementById(STOP_LOADING_BTN);
        if (button) {
            renderStopLoadingButton(button);
        }
    } catch (e) {
        logError(e);
    }
}

// Floating "Stop/Resume loading older videos" button on the subscriptions feed (#63): YouTube loads the
// next batch whenever its continuation element is in view, which with watched videos hidden is all
// the time, so it would load years of history.
function addStopLoadingButton() {
    removeStopLoadingButton();
    applyStopLoadingOlder();

    if (!isSubscriptionsPage() || getStopLoadingStyle() === "off" || !document.body) {
        return;
    }

    let button = document.createElement("button");
    button.setAttribute("id", STOP_LOADING_BTN);
    button.setAttribute("type", "button");
    button.classList.add("subs-btn-stop-loading");
    button.addEventListener("click", stopLoadingOlderClicked);
    renderStopLoadingButton(button);
    document.body.appendChild(button);

    brwsr.storage.onChanged.addListener(stopLoadingStorageChanged);
    watchMiniplayer();
}

// keeps other open subscriptions tabs in step with a click in this one
function stopLoadingStorageChanged(changes, areaName) {
    if (areaName !== "local" || !(STOP_LOADING_KEY in changes)) {
        return;
    }
    try {
        stopLoadingOlder = changes[STOP_LOADING_KEY].newValue === true;
        applyStopLoadingOlder();
        let button = document.getElementById(STOP_LOADING_BTN);
        if (button) {
            renderStopLoadingButton(button);
        }
    } catch (e) {
        logError(e);
    }
}

// keepLoadingStopped: leave the attribute that stops loading, so the feed being left doesn't load
// another batch while YouTube navigates (stopSubs() clears it)
function removeStopLoadingButton(keepLoadingStopped = false) {
    brwsr.storage.onChanged.removeListener(stopLoadingStorageChanged);
    stopLoadingObservers.forEach(observer => observer.disconnect());
    stopLoadingObservers = [];
    window.removeEventListener("resize", scheduleStopLoadingPlacement);
    clearTimeout(stopLoadingPlaceTimeout);

    let button = document.getElementById(STOP_LOADING_BTN);
    if (button) {
        button.remove();
    }
    if (!keepLoadingStopped) {
        document.documentElement.removeAttribute(STOP_LOADING_ATTR);
    }
}

// The box of YouTube's miniplayer while it is on screen in the bottom right, or null. Judged by
// geometry rather than by a state attribute, so a renamed attribute doesn't break it: the host
// element, or one of its children when the host box is empty or covers most of the page.
function getMiniplayerRect() {
    let miniplayer = document.querySelector("ytd-miniplayer");
    if (!miniplayer || window.getComputedStyle(miniplayer).visibility === "hidden") {
        return null;
    }
    for (let elem of [miniplayer, ...miniplayer.children]) {
        let rect = elem.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 &&
                rect.width < window.innerWidth * 0.75 && rect.height < window.innerHeight * 0.75 &&
                rect.top < window.innerHeight && rect.bottom > 0 &&
                rect.right > window.innerWidth - 200) {
            return rect;
        }
    }
    return null;
}

// moves the button up above the miniplayer while that is open
function placeStopLoadingButton() {
    let button = document.getElementById(STOP_LOADING_BTN);
    if (!button) {
        return;
    }
    let rect = getMiniplayerRect();
    button.style.bottom = rect ? (window.innerHeight - rect.top + 16) + "px" : "";
}

function scheduleStopLoadingPlacement() {
    placeStopLoadingButton();
    // and again once YouTube's open/close animation has settled
    clearTimeout(stopLoadingPlaceTimeout);
    stopLoadingPlaceTimeout = setTimeout(placeStopLoadingButton, 400);
}

function watchMiniplayer() {
    window.addEventListener("resize", scheduleStopLoadingPlacement);

    // ytd-app has miniplayer-is-active while the miniplayer is open
    let app = document.querySelector("ytd-app");
    if (app) {
        let mutationObserver = new MutationObserver(scheduleStopLoadingPlacement);
        mutationObserver.observe(app, {attributes: true, attributeFilter: ["miniplayer-is-active"]});
        stopLoadingObservers.push(mutationObserver);
    }

    let miniplayer = document.querySelector("ytd-miniplayer");
    if (miniplayer && typeof ResizeObserver !== "undefined") {
        let resizeObserver = new ResizeObserver(scheduleStopLoadingPlacement);
        resizeObserver.observe(miniplayer);
        stopLoadingObservers.push(resizeObserver);
    }

    scheduleStopLoadingPlacement();
}

function buildMenuButtonContainer() {
    let menuButtonContainer;
    menuButtonContainer = document.createElement("h2");
    menuButtonContainer.classList.add("yt-simple-endpoint");
    menuButtonContainer.classList.add("style-scope");
    menuButtonContainer.classList.add("ytd-compact-link-renderer");

    menuButtonContainer.classList.add("subs-grid-menu-item");

    return menuButtonContainer;
}

function deleteOldButton(ID) {
    const oldButton = document.querySelector(`#${ID}`);
    if (oldButton) {
        oldButton.remove();
    }
}

function addSettingsButton() {
    deleteOldButton(SETTINGS_BTN);

    let settingsButton = buildMenuButtonContainer();
    settingsButton.classList.add("subs-btn-settings");
    settingsButton.setAttribute("id", SETTINGS_BTN);

    addElementToMenuUI(settingsButton);

    // on the element itself: it isn't in the document when addElementToMenuUI() found no place
    settingsButton.addEventListener("click", () => brwsr.runtime.sendMessage({"action": "openOptionsPage"}));
}

function addHideAllMenuButton() {
    if (settings["settings.hide.watched.all.label"]) {
        deleteOldButton(MARK_ALL_WATCHED_BTN);

        let hideAllButtonContainer = buildMenuButtonContainer();
        hideAllButtonContainer.classList.add("subs-grid-menu-mark-all");
        hideAllButtonContainer.setAttribute("id", MARK_ALL_WATCHED_BTN);

        hideAllButtonContainer.appendChild(document.createTextNode("Mark all as watched"));

        addElementToMenuUI(hideAllButtonContainer);

        hideAllButtonContainer.addEventListener("click", markAllAsWatched);
    }
}

function addHideWatchedCheckbox() {
    if (settings["settings.hide.watched.label"]) {
        deleteOldButton(HIDE_WATCHED_LABEL);

        let hideWatchedLabel = buildMenuButtonContainer();
        hideWatchedLabel.setAttribute("id", HIDE_WATCHED_LABEL);
        hideWatchedLabel.appendChild(document.createTextNode("Hide watched")); //TODO: translations
        addElementToMenuUI(hideWatchedLabel);

        hideWatchedLabel.addEventListener("click", hideWatchedChanged);
    }

    deleteOldButton(HIDE_WATCHED_TOGGLE);

    let toggleContainer = document.createElement("div");
    toggleContainer.setAttribute("id", HIDE_WATCHED_TOGGLE);
    toggleContainer.classList.add("toggle-container", "style-scope", "tp-yt-paper-toggle-button");
    if (hideWatched) {
        toggleContainer.classList.add("subs-btn-hide-watched-checked");
    } else {
        toggleContainer.classList.add("subs-btn-hide-watched-unchecked");
    }

    let toggleBar = document.createElement("div");
    toggleBar.classList.add("toggle-bar", "style-scope", "tp-yt-paper-toggle-button");
    let toggleButton = document.createElement("div");
    toggleButton.classList.add("toggle-button", "style-scope", "tp-yt-paper-toggle-button");

    toggleContainer.appendChild(toggleBar);
    toggleContainer.appendChild(toggleButton);

    addElementToMenuUI(toggleContainer);

    toggleContainer.addEventListener("click", hideWatchedChanged);
}

function addElementToMenuUI(element) {
    log("Adding element to menu UI");

    // Try multiple possible insertion points for different YouTube layouts
    let insertionPoint = document.getElementById("end") ||                              // Old layout
                         document.querySelector("ytd-feed-filter-chip-bar-renderer") || // New layout chip bar
                         document.querySelector("#primary ytd-rich-grid-renderer") ||   // Grid container
                         document.querySelector("ytd-browse[page-subtype='subscriptions']"); // Page container

    if (insertionPoint != null) {
        if (insertionPoint.id === "end") {
            // Old layout behavior
            if (settings["settings.hide.watched.ui.stick.right"])
                insertionPoint.prepend(element);
            else
                insertionPoint.parentNode.insertBefore(element, insertionPoint);
        } else {
            // New layout behavior - respect stick-right setting
            if (settings["settings.hide.watched.ui.stick.right"]) {
                insertionPoint.appendChild(element);
            } else {
                insertionPoint.insertBefore(element, insertionPoint.firstChild);
            }
        }
        addedElems.push(element);
    } else {
        logError({"message": "Could not find UI insertion point", "stack": "subs-ui.js:addElementToMenuUI"});
    }
}

function buildMarkWatchedButton(dismissibleDiv, item, videoId, isMarkWatchedBtn = true) {
    let enclosingDiv = document.createElement("div");
    enclosingDiv.setAttribute("id", METADATA_LINE);
    enclosingDiv.classList.add("style-scope", "ytd-thumbnail-overlay-toggle-button-renderer");

    let button = document.createElement("button");
    button.setAttribute("id", isMarkWatchedBtn ? MARK_WATCHED_BTN : MARK_UNWATCHED_BTN);
    button.classList.add(isMarkWatchedBtn ? "subs-btn-mark-watched" : "subs-btn-mark-unwatched");
    button.setAttribute("role", "button");

    let vid = new SubscriptionVideo(item);
    if (isMarkWatchedBtn) {
        button.onclick = (event) => {
            // The compact button sits inside YouTube's clickable lockup: don't let the click reach it.
            event.stopPropagation();
            vid.markWatched();
        };
    } else {
        button.onclick = (event) => {
            event.stopPropagation();
            vid.markUnwatched();
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
        // Ignore for list view
        if (section.classList.contains("ytd-section-list-renderer")) break;

        let sectionTitle = sectionHeader.textContent;

        // add collapse button to sections
        addCollapsibleBtnToSection(sectionHeader);

        // hide or show sections
        if (section.querySelector(vidQuery()) == null) {
            // section has no videos that arent hidden, so hide it
            if (!section.classList.contains(HIDDEN_CLASS)) {
                logDebug("Hiding section '" + sectionTitle + "'");
                section.style.display = 'none';
                section.classList.add(HIDDEN_CLASS);
            }
        } else {
            // section has some videos that arent hidden, in case we hid it before, show it now
            if (section.classList.contains(HIDDEN_CLASS)) {
                logDebug("Showing section '" + sectionTitle + "'");
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
        if (isPlaylistSection(item) || isOnInactivePage(item)) continue;
        let vid = new SubscriptionVideo(item);

        if (!vid.isStored && isYouTubeWatched(item)) {
            vid.markWatched();
        } else if (vid.shouldHide()) {
            vid.hide();
            hiddenCount++;
        }

        // does it already have any button?
        if (!vid.hasButton()) {
            vid.addButton();
        }
    }

    const gridElement = document.querySelector('ytd-two-column-browse-results-renderer ytd-rich-grid-renderer #contents');

    // hide "Most Relevant" shelf if setting enabled
    if (hideMostRelevant && gridElement) {
        [...gridElement.querySelectorAll(':scope > ytd-rich-section-renderer')].forEach(section => {
            const richShelf = section.querySelector(':scope > #content > ytd-rich-shelf-renderer:not([is-shorts])');
            if (richShelf) {
                section.style.display = 'none';
            }
        });
    }

    // if shorts shelf is empty, hide it
    if (gridElement && isRendered(gridElement)) {
        [...gridElement.querySelectorAll(':scope > ytd-rich-section-renderer')].forEach(richSectionElement => {
            const contents = richSectionElement.querySelector(':scope > #content > ytd-rich-shelf-renderer > #dismissible #contents');

            // skip missing shelves and ones already hidden (e.g. "Most relevant" by its own setting)
            if (!contents || richSectionElement.style.display === 'none') {
                return;
            }
            if (![...contents.children].some(child => isRendered(child))) {
                richSectionElement.style.display = 'none';
                richSectionElement.classList.add(EMPTY_SHELF_HIDDEN_CLASS);
            }
        });
    }
    log("Removing watched from feed and adding overlay... Done");

    // if we hid any videos, see if sections need changing, or videos loading
    if (hiddenCount > 0) {
        processSections();
        loadMoreVideos();
    }
}

// Whether YouTube has finished building a card far enough to judge it: it has its link and, on
// lockup layouts, the metadata block with the title link in it.
function isVideoRendered(item) {
    let lockup = item.querySelector("yt-lockup-view-model, lockup-view-model");
    if (!lockup) {
        return item.querySelector("a[href]") != null;
    }
    let metadata = lockup.querySelector("yt-lockup-metadata-view-model, lockup-metadata-view-model");
    return metadata != null && metadata.querySelector("a[href]") != null;
}

// Handles a card the feed observer (see initSubs) saw YouTube render, before the browser paints it.
// Unlike removeWatchedAndAddButton() it only hides on positive evidence that the video is watched
// (stored as watched, or YouTube's progress bar): the other filters read badges that may not have
// rendered yet, and a card hidden by mistake is never rescanned, so those are left to the periodic
// scan. Returns whether the card was hidden.
function processRenderedVideo(item) {
    if (!isVideoRendered(item)) {
        // a later mutation inside the card brings it back here
        return false;
    }

    let vid = new SubscriptionVideo(item);

    // not markWatched(): that applies every filter, and e.g. a missing duration badge would hide the
    // card as a premiere
    if (!vid.isStored && isYouTubeWatched(item)) {
        vid.recordWatched();
    }
    let isHidden = vid.hidesAsWatched();
    if (isHidden) {
        vid.hide();
    }

    // Hidden cards get theirs too, ready for when "Hide watched" is switched off. A compact button
    // waits for the ⋮: the mutation that adds it brings the card back here.
    if (!vid.awaitsMenuButton() && !vid.hasButton()) {
        vid.addButton();
    }
    return isHidden;
}

// Takes the header controls and the floating stop-loading button down as soon as YouTube starts
// navigating, so they don't stay over the next page until navigation finishes. Unlike removeUI() it
// leaves the hidden videos of the feed being left hidden, and loading stopped if it was.
function removeControlsOnNavigateStart() {
    removedOnNavigateStart = removedOnNavigateStart || addedElems.length > 0 ||
        document.getElementById(STOP_LOADING_BTN) != null;
    navigatingAway = true;
    addedElems.forEach(elem => elem.remove());
    addedElems = [];
    removeStopLoadingButton(true);
}

// A navigation started but never finished (e.g. the next page failed to load) and the page is still
// the one the controls were taken from: put them back.
function restoreControlsAfterAbortedNavigation() {
    if (!navigatingAway) {
        return;
    }
    navigatingAway = false;
    if (removedOnNavigateStart) {
        removedOnNavigateStart = false;
        try {
            buildUI();
        } catch (e) {
            logError(e);
        }
    }
}

function removeUI() {
    navigatingAway = false;
    removedOnNavigateStart = false;
    addedElems.forEach((elem) => {
        elem.remove();  // Safe - doesn't throw if already removed from DOM
    });

    addedElems = [];
    removeStopLoadingButton();

    // delete built buttons and strip containers
    document.querySelectorAll(".subs-btn-container").forEach(e => e.remove());
    document.querySelectorAll("#" + METADATA_LINE).forEach(e => e.remove());
    // and the watched fade, which lives on the card rather than in the removed button
    document.querySelectorAll(".semitransparent").forEach(e => e.classList.remove("semitransparent"));

    // make hidden videos visible
    for (let item of hidden) {
        item.style.display = '';
        item.classList.remove(HIDDEN_CLASS);
    }
    hidden = [];
    showEmptyShelves();
}

function rebuildUI() {
    if (isSubscriptionsPage() && !navigatingAway) {
        try {
            removeUI();
            buildUI();
        } catch (e) {
            logError(e);
        }
    }
}
