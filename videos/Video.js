function getVideoIdFromUrl(url) {
    if (url.includes("shorts")) {
        return url.split("shorts/")[1].split("&")[0];
    } else {
        return url.split("=")[1].split("&")[0];
    }
}

function getVideoId(item) {
    let videoUrl = item.querySelectorAll("a")[0].getAttribute("href");
    if (videoUrl != null) {
        return getVideoIdFromUrl(videoUrl);
    } else {
        log("Video URL is null - ad.");
    }
}

function getVideoFuzzyDate(item) {
    let videoFuzzyDate = item.querySelectorAll(fuzzyDateQuery())[1];
    if (videoFuzzyDate != null) {
        return videoFuzzyDate.innerText;
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
        this.fuzzyDate = getVideoFuzzyDate(containingDiv);

        log("Checking video " + this.videoId + " for premiere");
        let thumbOverlay = containingDiv.querySelector("ytd-thumbnail-overlay-time-status-renderer");
        if (thumbOverlay == null) {
            this.isPremiere = false;
        } else {
            this.isPremiere = thumbOverlay.getAttribute("overlay-style") === "UPCOMING";
        }

        log("Checking video " + this.videoId + " for short");
        let videoHref = containingDiv.querySelectorAll("a")[0].getAttribute("href");
        if (videoHref != null) {
            this.isShort = (videoHref.includes("shorts") || videoHref.includes("adurl"));
        } else {
            log("Video URL is null - ad.");
            this.isShort = true;
        }
        log('video ' + this.videoId + " associated with date " + this.fuzzyDate)
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
        log(`isOlder: ${this.isOlder} based on cutoff: ${hideOlderCutoff}`)
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
        // if on chronological page, take up space to prevent layout shift
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
