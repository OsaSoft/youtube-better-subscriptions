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

class SubscriptionVideo {
    constructor(containingDiv) {
        this.containingDiv = containingDiv;
        this.videoId = getVideoId(containingDiv);
        this.isStored = this.videoId in storage;
        this.contentDiv = this.containingDiv.firstElementChild;
        this.button = this.isStored ? MARK_UNWATCHED_BTN : MARK_WATCHED_BTN;
    }

    hasButton() {
        return this.contentDiv.querySelector("#" + this.button) != null
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

    addButton() {
        let buttonContainer = this.contentDiv.firstChild;
        // stored = false - build "Mark as watched"
        // stored = true  - build "Mark as unwatched"
        let markButton = buildMarkWatchedButton(buttonContainer, this.containingDiv, this.videoId, !this.isStored);
        buttonContainer.appendChild(markButton);
    }
}
