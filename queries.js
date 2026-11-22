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
