import brwsr from '../browser';
import {PREFIX, isRendered, logError} from '../util';

import {log} from './common';
import {sectionContentsQuery, sectionDismissableQuery, sectionTitleQuery, sectionsQuery, vidQuery} from './queries';
import {getSettings} from './settings';
import {Video} from './videos/SubscriptionVideo';

export const HIDE_WATCHED_TOGGLE = `${PREFIX}hide-watched-toggle`;
export const HIDE_WATCHED_LABEL = `${PREFIX}hide-watched-toggle-label`;
export const MARK_ALL_WATCHED_BTN = `${PREFIX}subs-grid-menu-mark-all`;
export const SETTINGS_BTN = `${PREFIX}subs-grid-menu-settings`;
export const MARK_WATCHED_BTN = `${PREFIX}mark-watched`;
export const MARK_UNWATCHED_BTN = `${PREFIX}mark-unwatched`;
export const METADATA_LINE = `${PREFIX}metadata-line`;
export const COLLAPSE_SECTION_CHECKBOX = `${PREFIX}collapse-section`;
export const COLLAPSE_CLASS = `${PREFIX}collapse-section`;
export const HIDDEN_CLASS = `${PREFIX}hidden`;

let activelyHidingWatchedVideos = null;

const createdElements: HTMLElement[] = [];
const hiddenElements: HTMLElement[] = [];

function deleteOldButton(ID: string) {
    document.querySelector(`#${ID}`)?.remove();
}

function buildMenuButtonContainer() {
    const menuButtonContainer = document.createElement('h2');
    menuButtonContainer.classList.add(
        'yt-simple-endpoint',
        'style-scope',
        'ytd-compact-link-renderer',
        'subs-grid-menu-item',
    );

    return menuButtonContainer;
}

function addElementToMenuUI(element: HTMLElement) {
    log('Adding element to menu UI');

    const topMenuEnd = document.getElementById('end');
    if (topMenuEnd) {
        if (getSettings()['settings.hide.watched.ui.stick.right']) {
            topMenuEnd.prepend(element);
        }
        else {
            topMenuEnd.parentNode.insertBefore(element, topMenuEnd);
        }
    }

    createdElements.push(element);
}

function loadMoreVideos() {
    log('Loading more videos');

    // workaround to load more videos, slightly scroll in the sidebar :)
    const sidebar = document.getElementById('guide-inner-content');
    const top = sidebar.scrollTop;
    // +1 -1 so the scroll moves a bit even if its at complete bottom or top
    sidebar.scrollTop += 1;
    sidebar.scrollTop -= 1;
    // move it back to original position
    sidebar.scrollTop = top;
}

function isYouTubeWatched(item) {
    const ytWatchedPercentThreshold = getSettings()['settings.mark.watched.youtube.watched'];
    return (
        ytWatchedPercentThreshold === true && (
            item.querySelectorAll('yt-formatted-string.style-scope.ytd-thumbnail-overlay-playback-status-renderer').length > 0 //has "WATCHED" on thumbnail
            || item.querySelectorAll('#progress.style-scope.ytd-thumbnail-overlay-resume-playback-renderer').length > 0 //has progress bar on thumbnail TODO allow percentage threshold
            || item.hasAttribute('is-dismissed') //also hide empty blocks left in by pressing "HIDE" button
        )
    );
}

function showWatched() {
    log('Showing watched videos');

    for (const item of hiddenElements) {
        item.style.display = '';
        item.classList.remove(HIDDEN_CLASS);
    }
    hiddenElements.splice(0, hiddenElements.length);

    processSections();
}

export function buildMarkWatchedButton(dismissibleDiv, item, videoId, isMarkWatchedBtn = true) {
    const enclosingDiv = document.createElement('div');
    enclosingDiv.setAttribute('id', METADATA_LINE);
    enclosingDiv.classList.add('style-scope', 'ytd-thumbnail-overlay-toggle-button-renderer');
    createdElements.push(enclosingDiv);

    const button = document.createElement('button');
    button.setAttribute('id', isMarkWatchedBtn ? MARK_WATCHED_BTN : MARK_UNWATCHED_BTN);
    button.classList.add(isMarkWatchedBtn ? 'subs-btn-mark-watched' : 'subs-btn-mark-unwatched');
    button.setAttribute('role', 'button');

    const vid = new Video(item);
    if (isMarkWatchedBtn) {
        button.addEventListener('click', () => {
            vid.markWatched();
        });
    }
    else {
        button.addEventListener('click', () => {
            vid.markUnwatched();
            const metaDataElem = item.querySelector(`#${METADATA_LINE}`);
            const container = metaDataElem.parentNode;
            metaDataElem.remove();
            container.append(buildMarkWatchedButton(dismissibleDiv, item, videoId));
        });
    }

    enclosingDiv.append(button);

    if (isMarkWatchedBtn) {
        dismissibleDiv.classList.remove('semitransparent');
    }
    else {
        dismissibleDiv.classList.add('semitransparent');
    }

    return enclosingDiv;
}

export function changeMarkWatchedToMarkUnwatched(item, videoId) {
    // find Mark as watched button and change it to Unmark as watched
    const metaDataLine = item.querySelector(`#${METADATA_LINE}`);
    if (!metaDataLine) {
        return;
    }

    const dismissibleDiv = metaDataLine.parentNode;
    metaDataLine.remove();

    const markUnwatchedBtn = buildMarkWatchedButton(dismissibleDiv, item, videoId, false);
    dismissibleDiv.append(markUnwatchedBtn);
}


function collapseSectionChanged(event: Event) {
    try {
        const checkbox = event.target as HTMLInputElement;
        log(`Checkbox for section ${checkbox.getAttribute('id')} changed. New value is: ${checkbox.checked}`);

        const contentDiv = checkbox.closest(sectionDismissableQuery()).querySelector<HTMLElement>(sectionContentsQuery());
        if (checkbox.checked) {
            contentDiv.style.display = '';
        }
        else {
            contentDiv.style.display = 'none';
            loadMoreVideos();
        }
    }
    catch (error) {
        logError(error);
    }
}

let collapsibleIdNum = 0;

function addCollapsibleBtnToSection(sectionHeader: HTMLElement) {
    try {
        // only add if doesnt have it already
        if (sectionHeader.parentNode.querySelector(`.${COLLAPSE_CLASS}`)) {
            return;
        }

        const collapsibleId = COLLAPSE_SECTION_CHECKBOX + collapsibleIdNum++;

        const collapseCheckbox = document.createElement('input');
        collapseCheckbox.setAttribute('id', collapsibleId);
        collapseCheckbox.setAttribute('type', 'checkbox');
        collapseCheckbox.checked = true;
        collapseCheckbox.classList.add(COLLAPSE_CLASS);
        collapseCheckbox.addEventListener('change', collapseSectionChanged);

        sectionHeader.parentNode.append(collapseCheckbox);
    }
    catch (error) {
        logError(error);
    }
}

export function processSections() {
    log('Processing sections');

    const sections = document.querySelectorAll<HTMLElement>(sectionsQuery());
    log(`Found ${sections.length} sections.`);

    for (const section of sections) {
        const sectionHeader = section.querySelector<HTMLElement>(sectionTitleQuery());
        // Temporary fix for PAGES.channel TODO: refactor this (when more pages added)
        if (!sectionHeader) {
            break;
        }
        const sectionTitle = sectionHeader.textContent;

        // add collapse button to sections
        addCollapsibleBtnToSection(sectionHeader);

        // hide or show sections
        if (!section.querySelector(vidQuery())) {
            // section has no videos that arent hidden, so hide it
            if (!section.classList.contains(HIDDEN_CLASS)) {
                log(`Hiding section '${sectionTitle}'`);
                section.style.display = 'none';
                section.classList.add(HIDDEN_CLASS);

                // todo: sections should also be toggled back on in destroyUI()?
                // hiddenElements.push(section);
            }
        }
        else {
            // section has some videos that arent hidden, in case we hid it before, show it now
            if (section.classList.contains(HIDDEN_CLASS)) {
                log(`Showing section '${sectionTitle}'`);
                section.style.display = '';
                section.classList.remove(HIDDEN_CLASS);
            }
        }
    }
    log('Processing sections... Done');
}

function applyUIToVideos() {
    log('Removing watched from feed and adding overlay');

    let hiddenCount = 0;

    for (const item of document.querySelectorAll<HTMLElement>(vidQuery())) {
        const vid = new Video(item);

        if (!vid.isStored && isYouTubeWatched(item)) {
            vid.markWatched();
        }
        else if (
            (activelyHidingWatchedVideos && vid.isStored)
            || (getSettings()['settings.hide.premieres'] && vid.isPremiere)
            || (getSettings()['settings.hide.shorts'] && vid.isShort)
        ) {
            vid.hide();
            hiddenCount++;
        }

        if (!vid.hasButton()) {
            vid.addButton();
        }
    }

    // todo: doesn't work
    // if shorts shelf is empty, hide it
    const gridElement = document.querySelector('ytd-two-column-browse-results-renderer ytd-rich-grid-renderer #contents');
    if (gridElement && isRendered(gridElement)) {
        for (const richSectionElement of gridElement.querySelectorAll(':scope > ytd-rich-section-renderer')) {
            const contents = richSectionElement.querySelector(':scope > #content > ytd-rich-shelf-renderer > #dismissible > #contents');

            if (!contents) {
                continue;
            }
            if (![...contents.childNodes].some(child => isRendered(child))) {
                (richSectionElement as HTMLElement).style.display = 'none';
            }
        }
    }
    log('Removing watched from feed and adding overlay... Done');

    // if we hid any videos, see if sections need changing, or videos loading
    if (hiddenCount > 0) {
        processSections();
        loadMoreVideos();
    }
}

function addHideAllMenuButton() {
    if (!getSettings()['settings.hide.watched.all.label']) {
        return;
    }

    deleteOldButton(MARK_ALL_WATCHED_BTN);

    const hideAllButtonContainer = buildMenuButtonContainer();
    hideAllButtonContainer.classList.add('subs-grid-menu-mark-all');
    hideAllButtonContainer.setAttribute('id', MARK_ALL_WATCHED_BTN);
    hideAllButtonContainer.append(document.createTextNode('Mark all as watched'));

    hideAllButtonContainer.addEventListener('click', () => {
        for (const item of document.querySelectorAll<HTMLElement>(vidQuery())) {
            new Video(item).markWatched();
        }

        loadMoreVideos();
    });

    addElementToMenuUI(hideAllButtonContainer);
}

function hideWatchedChanged() {
    try {
        const toggle = document.getElementById(HIDE_WATCHED_TOGGLE);
        log(`Hide Watched checkbox was changed. New value is: ${!activelyHidingWatchedVideos}`);

        if (activelyHidingWatchedVideos) {
            activelyHidingWatchedVideos = false;
            toggle.classList.remove('subs-btn-hide-watched-checked');
            toggle.classList.add('subs-btn-hide-watched-unchecked');
            showWatched();
        }
        else {
            activelyHidingWatchedVideos = true;
            toggle.classList.remove('subs-btn-hide-watched-unchecked');
            toggle.classList.add('subs-btn-hide-watched-checked');
            applyUIToVideos();
        }
    }
    catch (error) {
        logError(error);
    }
}

function addHideWatchedCheckbox() {
    if (getSettings()['settings.hide.watched.label']) {
        deleteOldButton(HIDE_WATCHED_LABEL);

        const hideWatchedLabel = buildMenuButtonContainer();
        hideWatchedLabel.setAttribute('id', HIDE_WATCHED_LABEL);
        hideWatchedLabel.append(document.createTextNode('Hide watched')); //TODO: translations
        hideWatchedLabel.addEventListener('click', hideWatchedChanged);

        addElementToMenuUI(hideWatchedLabel);
    }

    deleteOldButton(HIDE_WATCHED_TOGGLE);

    const toggleContainer = document.createElement('div');
    toggleContainer.setAttribute('id', HIDE_WATCHED_TOGGLE);
    toggleContainer.classList.add('toggle-container', 'style-scope', 'tp-yt-paper-toggle-button');
    toggleContainer.addEventListener('click', hideWatchedChanged);

    toggleContainer.classList.add(
        activelyHidingWatchedVideos
            ? 'subs-btn-hide-watched-checked'
            : 'subs-btn-hide-watched-unchecked',
    );

    const toggleBar = document.createElement('div');
    toggleBar.classList.add('toggle-bar', 'style-scope', 'tp-yt-paper-toggle-button');

    const toggleButton = document.createElement('div');
    toggleButton.classList.add('toggle-button', 'style-scope', 'tp-yt-paper-toggle-button');

    toggleContainer.append(toggleBar);
    toggleContainer.append(toggleButton);

    addElementToMenuUI(toggleContainer);
}

function addSettingsButton() {
    deleteOldButton(SETTINGS_BTN);

    const settingsButton = buildMenuButtonContainer();
    settingsButton.classList.add('subs-btn-settings');
    settingsButton.setAttribute('id', SETTINGS_BTN);
    settingsButton.addEventListener('click', () => brwsr.runtime.sendMessage({'action': 'openOptionsPage'}));

    addElementToMenuUI(settingsButton);
}

export function hideElement(element: HTMLElement) {
    if (!activelyHidingWatchedVideos) {
        return;
    }

    hiddenElements.push(element);
    element.style.display = 'none';
    element.classList.add(HIDDEN_CLASS);

    processSections();
}

let intervalId: ReturnType<typeof setInterval>;

export function initUI() {
    log('Building UI');

    if (activelyHidingWatchedVideos === null || !getSettings()['settings.hide.watched.keep.state']) {
        activelyHidingWatchedVideos = getSettings()['settings.hide.watched.default'];
    }

    addHideWatchedCheckbox();
    addHideAllMenuButton();
    addSettingsButton();

    if (getSettings()['settings.hide.watched.ui.stick.right']) {
        createdElements[0].after(...createdElements);
    }

    intervalId = setInterval(() => {
        try {
            applyUIToVideos();
        }
        catch (error) {
            logError(error);
        }
    }, getSettings()['settings.hide.watched.refresh.rate']);

    applyUIToVideos();

    log('Building UI... DONE');
}
export function destroyUI() {
    log('Stripping down UI');

    for (const elem of createdElements) {
        elem.remove();
    }

    createdElements.splice(0, createdElements.length);

    for (const item of hiddenElements) {
        item.style.display = '';
        item.classList.remove(HIDDEN_CLASS);
    }
    hiddenElements.splice(0, hiddenElements.length);

    clearInterval(intervalId);
}
