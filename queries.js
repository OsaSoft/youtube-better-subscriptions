function vidQuery() {
    return [
        `ytd-grid-video-renderer.style-scope.ytd-grid-renderer:not(.${HIDDEN_CLASS}):not(.${OLDER_CLASS})`,
        `ytd-rich-item-renderer.style-scope.ytd-rich-grid-renderer:not(.${HIDDEN_CLASS}):not(.${OLDER_CLASS})`,
        `ytd-rich-item-renderer.style-scope.ytd-rich-grid-row:not(.${HIDDEN_CLASS}):not(.${OLDER_CLASS})`,
        `ytd-rich-item-renderer.style-scope.ytd-rich-shelf-renderer:not([is-post]):not(.${HIDDEN_CLASS}):not(.${OLDER_CLASS})`
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

function fuzzyDateQuery() {
    return '#metadata-line>span';
}

function searchContainerQuery() {
    return "ytd-searchbox.style-scope"
}

function logoQuery() {
    return "#logo"
}

function centerHeaderQuery() {
    return "#center"
}
