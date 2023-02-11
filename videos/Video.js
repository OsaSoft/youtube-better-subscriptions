function getVideoIdFromUrl(url) {
    if (url.includes("shorts")) {
        return url.split("shorts/")[1].split("&")[0];
    } else {
        return url.split("=")[1].split("&")[0];
    }
}

function getVideoId(item) {
    return getVideoIdFromUrl(item.querySelectorAll("a")[0].getAttribute("href"));
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

class Video {
    constructor(containingDiv) {
        this.containingDiv = containingDiv;
        this.videoId = getVideoId(containingDiv);
        this.isStored = this.videoId in storage;
        this.buttonId = this.isStored ? MARK_UNWATCHED_BTN : MARK_WATCHED_BTN;

        log("Checking video " + this.videoId + " for premiere");
        let thumbOverlay = containingDiv.querySelector("ytd-thumbnail-overlay-time-status-renderer");
        if (thumbOverlay == null) {
            this.isPremiere = false;
        } else {
            this.isPremiere = thumbOverlay.getAttribute("overlay-style") === "UPCOMING";
        }

        log("Checking video " + this.videoId + " for short");
        this.isShort = containingDiv.querySelectorAll("a")[0].getAttribute("href").includes("shorts");
    }

    hasButton() {
        throw Error("Subclasses must implement hasButton method");
    }

    addButton() {
        throw Error("Subclasses must implement addButton method");
    }

    hide() {
        hideItem(this.containingDiv);
    }

    markWatched() {
        changeMarkWatchedToMarkUnwatched(this.containingDiv);

        if (hideWatched) {
            this.hide();
            processSections();
        }

        setVideoInStorage(this.videoId);
        this.isStored = true;
    }

    markUnwatched() {
        getStorage().remove(this.videoId);
    }
}