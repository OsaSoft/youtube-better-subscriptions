function vidQuery() {
    return [
        `ytd-grid-video-renderer.style-scope.ytd-grid-renderer:not(.${HIDDEN_CLASS})`,
        `ytd-rich-item-renderer.style-scope.ytd-rich-grid-renderer:not(.${HIDDEN_CLASS})`,
        `ytd-rich-item-renderer.style-scope.ytd-rich-grid-row:not(.${HIDDEN_CLASS})`,
        `ytd-rich-item-renderer.style-scope.ytd-rich-shelf-renderer:not([is-post]):not(.${HIDDEN_CLASS})`,
        `ytd-item-section-renderer.style-scope.ytd-section-list-renderer:not(.${HIDDEN_CLASS})`,
        // New January 2026 layout with lockupViewModel
        `ytd-rich-item-renderer:has(lockup-view-model):not(.${HIDDEN_CLASS})`
    ].join(',');
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
