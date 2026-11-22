function vidQuery() {
    return [
        `ytd-grid-video-renderer.style-scope.ytd-grid-renderer:not(.${HIDDEN_CLASS})`,
        `ytd-rich-item-renderer.style-scope.ytd-rich-grid-renderer:not(.${HIDDEN_CLASS})`,
        `ytd-rich-item-renderer.style-scope.ytd-rich-grid-row:not(.${HIDDEN_CLASS})`,
        `ytd-rich-item-renderer.style-scope.ytd-rich-shelf-renderer:not([is-post]):not(.${HIDDEN_CLASS})`,
        `ytd-item-section-renderer.style-scope.ytd-section-list-renderer:not(.${HIDDEN_CLASS})`,
        // New January 2026 layout with lockupViewModel
        `ytd-rich-item-renderer:has(lockup-view-model):not(.${HIDDEN_CLASS})`,
        `${playlistVideoQuery()}:not(.${HIDDEN_CLASS})`
    ].join(',');
}

// Rows of a playlist page (/playlist?list=…, #209), hidden or not. Since November 2026 each row is a
// plain div around a horizontal lockup. The div, not the lockup, is the row: it carries the gap to the
// next row, so hiding it closes the list up.
function playlistVideoQuery() {
    return "yt-item-section-renderer > #contents > div:has(> yt-lockup-view-model)";
}

// A list-view section (matched by vidQuery()) that holds a whole playlist in YouTube's older playlist
// layout, ytd-playlist-video-renderer rows: not one video. Checked in JS, as :not(:has()) in vidQuery()
// doesn't parse in jsdom.
function isPlaylistSection(item) {
    return item.querySelector("ytd-playlist-video-renderer, ytd-playlist-video-list-renderer") != null;
}

// YouTube keeps pages visited earlier in the DOM as hidden ytd-browse elements. Their videos match
// vidQuery() too, but belong to a page that isn't on screen: leave them alone.
function isOnInactivePage(item) {
    return item.closest("ytd-browse[hidden]") != null;
}

function sectionsQuery() {
    return "ytd-item-section-renderer.style-scope.ytd-section-list-renderer";
}

function sectionTitleQuery() {
    return "#title";
}

function sectionDismissableQuery() {
    return "#dismissible";
}

function sectionContentsQuery() {
    return "#contents";
}
