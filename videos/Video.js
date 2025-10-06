function getVideoIdFromUrl(url) {
    const segment = url.includes("shorts") ? url.split("shorts/")[1] : url.split("=")[1];

    return segment ? segment.split("&")[0] : null;
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

function getVideoDuration(item) {
    let durationDiv = item.containingDiv.querySelector(".yt-badge-shape__text");
    if ((durationDiv != null) && (durationDiv.textContent.includes(":"))) {
        return durationDiv.textContent;
    } else {
        return null;
    }
}

function getVideoFuzzyDate(item) {
    let videoFuzzyDate = item.querySelectorAll(".yt-content-metadata-view-model__metadata-text")[2].innerText
    if (videoFuzzyDate != null) {
        return videoFuzzyDate;
    }
    else {
        log("Unable to determine video date")
    }
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
        this.fuzzyDate = containingDiv.querySelectorAll(".yt-content-metadata-view-model__metadata-text")[2].innerText
        this.videoDuration = getVideoDuration(this);

        log("Checking video " + this.videoId + " for premiere: duration = " + this.videoDuration);
        if (this.videoDuration == null) {
            this.isPremiere = true;
        }

        log("Checking video " + this.videoId + " for short");
        let videoHref = getVideoUrl(containingDiv);
        if (videoHref != null) {
            this.isShort = (videoHref.includes("shorts") || videoHref.includes("adurl"));
        } else {
            log("Video URL is null - ad.");
            this.isShort = true;
        }
        if (this.fuzzyDate != null) {
            this.isOlder = false;
            log(this.fuzzyDate)
            if (this.fuzzyDate.includes("month") || this.fuzzyDate.includes("year")) {
                this.isOlder = true;
            }
            else if (this.fuzzyDate.includes("weeks") && hideOlderCutoff != "1 Month") {
                this.isOlder = true;
            }
            else if (this.fuzzyDate.includes("day")) {
                if (hideOlderCutoff == "Today") {
                    this.isOlder = true;
                }
                else if (hideOlderCutoff == "1 Week" && Number(this.fuzzyDate.match(/\d+/)[0]) >= 7) {
                    this.isOlder = true;
                }
            }
        }
        else{
            this.isOlder = null;
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

    hideOlder() {
        older.push(this.containingDiv);
        // if on chronological page (subscriptions), take up space to prevent layout shift
        this.containingDiv.style.visibility = 'hidden';
        this.containingDiv.classList.add(OLDER_CLASS);
        // otherwise if on home page, hide and allow continuation of home page feed
        if (getCurrentPage() == PAGES.home) this.containingDiv.style.display = 'none';
        // TODO: support setting toggle for hide behavior on various other pages, like channel pages
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
