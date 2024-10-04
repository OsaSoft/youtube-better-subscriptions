function getVideoIdFromUrl(url) {
    if (url.includes("shorts")) {
        return url.split("shorts/")[1].split("&")[0];
    } else {
        return url.split("=")[1].split("&")[0];
    }
}

function getVideoUrl(item) {
    let videoLink = item.querySelectorAll("a#video-title")[0] || item.querySelectorAll("a")[0];

    if (!videoLink) {
        return null;
    }

    let videoUrl = videoLink.getAttribute("href");

    if (videoUrl != null) {
        return videoUrl;
    } else {
        log("Video URL is null - ad.");
        return null;
    }
}

function getVideoId(item) {
    let url = getVideoUrl(item);

    return url ? getVideoIdFromUrl(url) : null;
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
        this.isStored = watchedVideos['w' + this.videoId];
        this.buttonId = this.isStored ? MARK_UNWATCHED_BTN : MARK_WATCHED_BTN;

        log("Checking video " + this.videoId + " for premiere");
        let thumbOverlay = containingDiv.querySelector("ytd-thumbnail-overlay-time-status-renderer");
        if (thumbOverlay == null) {
            this.isPremiere = false;
        } else {
            this.isPremiere = thumbOverlay.getAttribute("overlay-style") === "UPCOMING";
        }

        log("Checking video " + this.videoId + " for short");
        let videoHref = getVideoUrl(containingDiv);
        if (videoHref != null) {
            this.isShort = (videoHref.includes("shorts") || videoHref.includes("adurl"));
        } else {
            log("Video URL is null - ad.");
            this.isShort = true;
        }
    }

    hasButton() {
        throw Error("Subclasses must implement hasButton method");
    }

    addButton() {
        throw Error("Subclasses must implement addButton method");
    }

    hide() {
        hidden.push(this.containingDiv);
        this.containingDiv.style.display = 'none';
        this.containingDiv.classList.add(HIDDEN_CLASS);
    }

    markWatched() {
        changeMarkWatchedToMarkUnwatched(this.containingDiv);

        if (hideWatched) {
            this.hide();
            processSections();
        }

        this.isStored = true;

        watchVideo(this.videoId);
        syncWatchedVideos();
    }

    markUnwatched() {
        unwatchVideo(this.videoId);

        syncWatchedVideos();
    }
}
