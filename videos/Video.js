function getVideoIdFromUrl(url) {
    const segment = url.includes("shorts") ? url.split("shorts/")[1] : url.split("=")[1];

    return segment ? segment.split("&")[0] : null;
}

function getVideoUrl(item) {
    // Try old layout selector first
    let videoLink = item.querySelectorAll("a#video-title")[0];

    // Try new January 2026 lockupViewModel layout
    if (!videoLink) {
        // In the new layout, the main link is inside lockup-view-model
        let lockupViewModel = item.querySelector("lockup-view-model");
        if (lockupViewModel) {
            videoLink = lockupViewModel.querySelector("a");
        }
    }

    // Fallback to any link
    if (!videoLink) {
        videoLink = item.querySelectorAll("a")[0];
    }

    if (!videoLink) {
        return null;
    }

    let videoUrl = videoLink.getAttribute("href");

    if (videoUrl != null) {
        return videoUrl;
    } else {
        logDebug("Video URL is null - ad.");
        return null;
    }
}

function getVideoId(item) {
    let url = getVideoUrl(item);

    return url ? getVideoIdFromUrl(url) : null;
}

// The video's title, or "" when the card hasn't rendered it yet. The lockup layouts (feed, home,
// channel, playlist rows, Shorts) put it in the title attribute of the heading (lockups) or of the
// link inside it (Shorts); the older layout in #video-title. Not the link's aria-label: YouTube
// appends the duration to it.
function getVideoTitle(item) {
    let heading = item.querySelector("h3[title]");
    if (heading && heading.getAttribute("title").trim()) {
        return heading.getAttribute("title").trim();
    }
    let link = item.querySelector("h3 a[title], #video-title");
    if (link) {
        return (link.getAttribute("title") || link.textContent || "").trim();
    }
    return "";
}

function getBadgeDuration(item, badgeTextSelector) {
    // A card can have several badges (e.g. "Members only" before the duration), so check all of them
    for (const badgeText of item.containingDiv.querySelectorAll(badgeTextSelector)) {
        if (badgeText.textContent.includes(":")) {
            return badgeText.textContent;
        }
    }
    return null;
}

function getVideoDuration(item) {

    // Try old layout selector
    let duration = getBadgeDuration(item, ".ytBadgeShapeText");
    if (duration != null) {
        return duration;
    }

    // Try new lockupViewModel layout - duration badge is in thumbnail-badge-view-model
    let lockupViewModel = item.containingDiv.querySelector("lockup-view-model");
    if (lockupViewModel) {
        let badgeViewModel = lockupViewModel.querySelector("thumbnail-badge-view-model");
        if (badgeViewModel) {
            let badgeText = badgeViewModel.textContent.trim();
            if (badgeText && badgeText.includes(":")) {
                return badgeText;
            }
        }
    }

    // Try older layout selector pre 2026-04
    return getBadgeDuration(item, ".yt-badge-shape__text");
}

// Seconds in a duration badge text ("0:45", "56:28", "1:29:19"), or null for anything else
// ("SHORTS", "LIVE", empty, not loaded yet)
function parseDurationSeconds(text) {
    if (typeof text !== "string") {
        return null;
    }
    let trimmed = text.trim();
    if (!/^\d+(:\d{2}){1,2}$/.test(trimmed)) {
        return null;
    }
    return trimmed.split(":").reduce((seconds, part) => seconds * 60 + parseInt(part, 10), 0);
}

// A duration filter's limit in minutes, or null when the filter is off or its value isn't a
// positive number (an empty, zero or negative value turns the filter off)
function durationFilterMinutes(enabledKey, minutesKey) {
    if (typeof settings === "undefined" || !settings || !settings[enabledKey]) {
        return null;
    }
    let minutes = Number(settings[minutesKey]);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

function isLivestream(item) {
    // Check for LIVE badge using CSS class (language-independent)
    // ytBadgeShapeThumbnailLive since 2026-08, yt-badge-shape--thumbnail-live before
    let liveBadge = item.containingDiv.querySelector(".ytBadgeShapeThumbnailLive, .yt-badge-shape--thumbnail-live");
    return liveBadge != null;
}

function isMembersOnly(item) {
    // Check for membership badge using CSS class (language-independent)
    // ytBadgeShapeCommerce (metadata row badge) in the camelCase badge classes since 2026-08,
    // yt-badge-shape--membership before
    let memberBadge = item.containingDiv.querySelector(".ytBadgeShapeCommerce, .yt-badge-shape--membership");
    return memberBadge != null;
}

function getPosterChannelId(video) {
    // Return cached non-null ID
    if (video._posterChannelId !== undefined && video._posterChannelId !== null) {
        return video._posterChannelId;
    }

    // pageContext.js (running in page world) tags collab renderers with data-poster-channel-id
    const renderer = video.containingDiv.closest('ytd-rich-item-renderer');
    if (renderer && renderer.dataset.posterChannelId) {
        video._posterChannelId = renderer.dataset.posterChannelId;
        return video._posterChannelId;
    }

    // Don't memoize absence - pageContext.js tags asynchronously, allow re-check
    return null;
}

// The channel pageContext.js read from the card's data (data-ybs-channel-*), if it was read for this
// video: YouTube may reuse a renderer for another one
function getTaggedVideoChannel(video) {
    const renderer = video.containingDiv.closest('ytd-rich-item-renderer');
    if (!renderer || !renderer.dataset.ybsChannelId || renderer.dataset.ybsChannelVideo !== video.videoId) {
        return null;
    }
    const fromUrl = channelFromHref(renderer.dataset.ybsChannelUrl || "");
    return makeChannel(renderer.dataset.ybsChannelId || null, fromUrl ? fromUrl.handle : null);
}

// Whether pageContext.js read this card's data (for this video) and found no channel in it
function isReadWithoutChannel(video) {
    const renderer = video.containingDiv.closest('ytd-rich-item-renderer');
    return Boolean(renderer && renderer.dataset.ybsChannelVideo === video.videoId && !renderer.dataset.ybsChannelId);
}

// The channel a card belongs to, for the channel exceptions (#280), as {id, handle} with what is
// known of each, or null while it isn't known (pageContext.js tags cards asynchronously). On a
// channel page that's the page's channel (its cards don't name it). Elsewhere the channel
// pageContext.js tagged, completed from the card's channel link; for a collab only the tagged
// uploader, as its first channel link may be a co-creator's.
function getVideoChannel(video) {
    let channel = getCurrentChannel();
    if (channel) {
        return channel;
    }

    let tagged = getTaggedVideoChannel(video);
    if (video.isCollaboration) {
        let posterChannelId = getPosterChannelId(video);
        return tagged || (posterChannelId ? {id: posterChannelId, handle: null} : null);
    }

    for (let link of video.containingDiv.querySelectorAll('a[href^="/@"], a[href^="/channel/"]')) {
        channel = channelFromHref(link.getAttribute("href"));
        if (channel) {
            return mergeChannels(channel, tagged);
        }
    }
    return tagged;
}

function changeMarkWatchedToMarkUnwatched(video) {
    // find Mark as watched button and change it to Unmark as watched
    let item = video.containingDiv;
    let metaDataLine = item.querySelector("#" + METADATA_LINE);
    if (metaDataLine != null) {
        let buttonParent = metaDataLine.parentNode;
        buttonParent.removeChild(metaDataLine);

        // Fade the element addButton() fades for a video that loads as watched, not the button's
        // own container, so the card looks the same straight after the click as after a reload.
        let fadeTarget = video.getFadeTarget() || item;
        let markUnwatchedBtn = buildMarkWatchedButton(fadeTarget, item, video.videoId, false);
        buttonParent.appendChild(markUnwatchedBtn);
    }
}

class Video {
    constructor(containingDiv) {
        this.containingDiv = containingDiv;
        this.videoId = getVideoId(containingDiv);
        this.isStored = watchedVideos['w' + this.videoId];
        this.buttonId = this.isStored ? MARK_UNWATCHED_BTN : MARK_WATCHED_BTN;
        this.videoDuration = getVideoDuration(this);

        // Detect livestream first (language-independent via CSS class)
        this.isLivestream = isLivestream(this);
        logDebug("Checking video " + this.videoId + " for livestream: " + this.isLivestream);

        // Detect members-only content (language-independent via CSS class)
        this.isMembersOnly = isMembersOnly(this);
        logDebug("Checking video " + this.videoId + " for members-only: " + this.isMembersOnly);

        logDebug("Checking video " + this.videoId + " for short");
        let videoHref = getVideoUrl(containingDiv);
        if (videoHref != null) {
            this.isShort = (videoHref.includes("shorts") || videoHref.includes("adurl"));
        } else {
            logDebug("Video URL is null - ad.");
            this.isShort = true;
        }

        // Only mark as premiere if no duration AND not a livestream AND not a short (shorts have no duration badge)
        logDebug("Checking video " + this.videoId + " for premiere: duration = " + this.videoDuration);
        if (this.videoDuration == null && !this.isLivestream && !this.isShort) {
            this.isPremiere = true;
        }

        this.isMix = videoHref != null && videoHref.includes("start_radio=1");
        logDebug("Checking video " + this.videoId + " for mix: " + this.isMix);

        this.isCollaboration = this.containingDiv.querySelector('yt-avatar-stack-view-model') !== null;
        this._posterChannelId = undefined; // lazy-loaded
    }

    hasButton() {
        throw Error("Subclasses must implement hasButton method");
    }

    addButton() {
        throw Error("Subclasses must implement addButton method");
    }

    getFadeTarget() {
        // Subclasses return the element faded when the video is watched; callers fall back to the item
        return null;
    }

    // The "Hide watched" rule alone, which needs nothing from the card beyond its link
    hidesAsWatched() {
        return Boolean(hideWatched && this.isStored && !this.isMix);
    }

    // The filters a channel on the exception list skips: premieres, live streams and members-only
    hidesByChannelFilters() {
        return Boolean(
                (hidePremieres && this.isPremiere) ||
                (hideLives && this.isLivestream) ||
                (hideMembersOnly && this.isMembersOnly)
        );
    }

    // With exceptions set, a card whose channel isn't known yet counts as exempt for now: it stays
    // visible and the next scan checks it again, while a hidden card wouldn't be scanned again
    isFromExemptChannel() {
        if (!hasChannelExceptions()) {
            return false;
        }
        let channel = getVideoChannel(this);
        // not known yet: leave it visible until pageContext.js has read the card; read with no
        // channel (and no channel link): no exception can apply
        return channel === null ? !isReadWithoutChannel(this) : isChannelExempt(channel);
    }

    // "Hide videos shorter/longer than" (#69): only cards with a known duration; Shorts, live
    // streams, premieres and cards whose badge hasn't loaded yet are never hidden by it. A video
    // of exactly the limit stays visible.
    hidesByDuration() {
        if (this.isShort || this.isLivestream || this.isPremiere) {
            return false;
        }
        let seconds = parseDurationSeconds(this.videoDuration);
        if (seconds === null) {
            return false;
        }
        let shorterMinutes = durationFilterMinutes("settings.hide.duration.shorter", "settings.hide.duration.shorter.minutes");
        let longerMinutes = durationFilterMinutes("settings.hide.duration.longer", "settings.hide.duration.longer.minutes");
        return Boolean(
                (shorterMinutes !== null && seconds < shorterMinutes * 60) ||
                (longerMinutes !== null && seconds > longerMinutes * 60)
        );
    }

    shouldHide() {
        // the exception never overrides "Hide watched", Hide Shorts, the duration filters or the
        // collab filter
        return Boolean(
                this.hidesAsWatched() ||
                (hideShorts && this.isShort) ||
                this.hidesByDuration() ||
                (hideCollabsUnsubscribed && this.isCollaboration && isSubscriptionsPage() && !isSubscribedToChannel(getPosterChannelId(this))) ||
                (this.hidesByChannelFilters() && !this.isFromExemptChannel())
        );
    }

    hide() {
        hidden.push(this.containingDiv);
        this.containingDiv.style.display = 'none';
        this.containingDiv.classList.add(HIDDEN_CLASS);
    }

    markWatched() {
        this.recordWatched();

        if (this.shouldHide()) {
            this.hide();
            processSections();
        }
    }

    // Stores the video as watched and swaps its button, without hiding the card
    recordWatched() {
        changeMarkWatchedToMarkUnwatched(this);

        this.isStored = true;
        this.buttonId = MARK_UNWATCHED_BTN;

        watchVideo(this.videoId);
        syncWatchedVideos();
    }

    markUnwatched() {
        unwatchVideo(this.videoId);

        syncWatchedVideos();
    }
}
