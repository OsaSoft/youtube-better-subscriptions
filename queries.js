function vidQuery() {
    if (isPolymer) {
        return "ytd-grid-video-renderer.style-scope.ytd-grid-renderer:not(." + HIDDEN_CLASS + ")" +
                ", ytd-rich-item-renderer.style-scope.ytd-rich-grid-renderer:not(." + HIDDEN_CLASS + ")" +
                ", ytd-rich-item-renderer.style-scope.ytd-rich-grid-row:not(." + HIDDEN_CLASS + ")";
    } else {
        return ".feed-item-container .yt-shelf-grid-item:not(." + HIDDEN_CLASS + ")";
    }
}

function sectionsQuery() {
    if (isPolymer) {
        return "ytd-item-section-renderer.style-scope.ytd-section-list-renderer";
    } else {
        return ".item-section";
    }
}

function sectionTitleQuery() {
    if (isPolymer) {
        return "#title";
    } else {
        return "span.branded-page-module-title-text";
    }
}

function sectionDismissableQuery() {
    if (isPolymer) {
        return "#dismissible";
    } else {
        return ".feed-item-dismissable";
    }
}

function sectionContentsQuery() {
    if (isPolymer) {
        return "#contents";
    } else {
        return ".multirow-shelf";
    }
}
