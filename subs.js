let hidden = [];
let hideWatched = null;
let hidePremieres = null;
let hideShorts = null;
let hideLives = null;
let hideMembersOnly = null;
let hideCollabsUnsubscribed = null;
let hideMostRelevant = null;
let intervalId = null;
let feedObserver = null;
let feedSectionsFrame = null;
// bumped by stopSubs(): an initSubs() still awaiting storage when a navigation unloads the page
// sees it changed and stops, so it can't build controls or start a scan on the next page
let subsRun = 0;

// Cards the feed observer reacts to. List-view sections (ytd-item-section-renderer) are left to the
// periodic scan: a mutation anywhere in a section would otherwise rescan it. Playlist rows are small,
// like grid cards.
const FEED_CARD_QUERY = "ytd-rich-item-renderer, ytd-grid-video-renderer, " + playlistVideoQuery();

function isYouTubeWatched(item) {
    let ytWatchedPercentThreshold = settings["settings.mark.watched.youtube.watched"];
    return ytWatchedPercentThreshold === true && (
            (item.querySelectorAll("yt-formatted-string.style-scope.ytd-thumbnail-overlay-playback-status-renderer").length > 0 || //has "WATCHED" on thumbnail
                    item.querySelectorAll("#progress.style-scope.ytd-thumbnail-overlay-resume-playback-renderer").length > 0 || //has progress bar on thumbnail TODO allow percentage threshold
                    item.querySelectorAll(".ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment").length > 0 || // new YT layout as of 09/2025
                    item.querySelectorAll("thumbnail-overlay-progress-bar-view-model").length > 0) || // new lockupViewModel layout as of 01/2026
            item.hasAttribute("is-dismissed") //also hide empty blocks left in by pressing "HIDE" button
    )
}

function hideWatchedChanged(event) {
    try {
        let toggle = document.getElementById(HIDE_WATCHED_TOGGLE);
        log("Hide Watched checkbox was changed. New value is: " + !hideWatched);

        if (hideWatched) {
            hideWatched = false;
            toggle.classList.remove("subs-btn-hide-watched-checked");
            toggle.classList.add("subs-btn-hide-watched-unchecked");
            showWatched();
        } else {
            hideWatched = true;
            toggle.classList.remove("subs-btn-hide-watched-unchecked");
            toggle.classList.add("subs-btn-hide-watched-checked");
            removeWatchedAndAddButton();
        }
    } catch (e) {
        logError(e);
    }
}

function collapseSectionChanged(event) {
    try {
        let checkbox = event.target;
        log("Checkbox for section " + checkbox.getAttribute("id") + " changed. New value is: " + checkbox.checked);

        let contentDiv = checkbox.closest(sectionDismissableQuery()).querySelector(sectionContentsQuery());
        if (checkbox.checked) {
            contentDiv.style.display = '';
        } else {
            contentDiv.style.display = 'none';
            loadMoreVideos();
        }
    } catch (e) {
        logError(e);
    }
}

function markAllAsWatched() {
    let els = document.querySelectorAll(vidQuery());

    for (let item of els) {
        if (isPlaylistSection(item) || isOnInactivePage(item)) continue;
        new SubscriptionVideo(item).markWatched();
    }

    loadMoreVideos();
}

function loadMoreVideos() {
    // the user stopped YouTube from loading older videos (see addStopLoadingButton)
    if (document.documentElement.hasAttribute(STOP_LOADING_ATTR)) {
        return;
    }
    log("Loading more videos");

    // workaround to load more videos, slightly scroll in the sidebar :)
    let sidebar = document.getElementById("guide-inner-content");
    if (!sidebar) return;
    let top = sidebar.scrollTop;
    // +1 -1 so the scroll moves a bit even if its at complete bottom or top
    sidebar.scrollTop += 1;
    sidebar.scrollTop -= 1;
    // move it back to original position
    sidebar.scrollTop = top;
}

// MutationObserver callback: runs as a microtask right after YouTube's DOM change, before the
// browser paints, so a card is first painted with its button already in place (no row jump, no
// pop-in). Only the cards touched by the mutations are processed, not the whole feed.
function onFeedMutations(records) {
    try {
        let cards = new Set();
        for (let record of records) {
            // our own buttons being built or swapped
            if (record.target.closest && record.target.closest(".subs-btn-container")) {
                continue;
            }
            for (let node of record.addedNodes) {
                if (node.nodeType !== 1 || node.classList.contains("subs-btn-container")) {
                    continue;
                }
                // a new card, or content arriving in a card YouTube added earlier
                let card = node.closest(FEED_CARD_QUERY);
                if (card) {
                    cards.add(card);
                } else if (node.firstElementChild) {
                    node.querySelectorAll(FEED_CARD_QUERY).forEach(c => cards.add(c));
                }
            }
        }
        if (cards.size === 0) {
            return;
        }

        let query = vidQuery();
        let hiddenCount = 0;
        for (let card of cards) {
            if (card.isConnected && card.matches(query) && !isOnInactivePage(card) && processRenderedVideo(card)) {
                hiddenCount++;
            }
        }

        // once per frame, however many mutation bursts hid cards in it
        if (hiddenCount > 0 && feedSectionsFrame == null) {
            feedSectionsFrame = window.requestAnimationFrame(function () {
                feedSectionsFrame = null;
                try {
                    processSections();
                    loadMoreVideos();
                } catch (e) {
                    logError(e);
                }
            });
        }
    } catch (e) {
        logError(e);
    } finally {
        // drop the records our own insertions just produced
        if (feedObserver) {
            feedObserver.takeRecords();
        }
    }
}

function getVideoTitle(item) {
    // Try old layout
    let titleElem = item.querySelector("#video-title");
    if (titleElem && titleElem.title) {
        return titleElem.title;
    }

    // Try new lockupViewModel layout - the title is in an anchor tag
    let lockupViewModel = item.querySelector("lockup-view-model");
    if (lockupViewModel) {
        let link = lockupViewModel.querySelector("a");
        if (link) {
            return link.getAttribute("title") || link.textContent.trim();
        }
    }

    return "";
}

async function initSubs() {
    log("Initializing subs page...");
    const run = subsRun;

    await loadWatchedVideos();
    if (run !== subsRun) {
        log("Initializing subs page... superseded by a navigation");
        return;
    }

    // before the first hide pass: a card hidden by mistake isn't scanned again
    await loadChannelExceptions();
    if (run !== subsRun) {
        log("Initializing subs page... superseded by a navigation");
        return;
    }

    if (hideWatched == null || !settings["settings.hide.watched.keep.state"]) {
        hideWatched = settings["settings.hide.watched.default"];
    }
    if (hidePremieres == null) {
        hidePremieres = settings["settings.hide.premieres"];
    }
    if (hideShorts == null) {
        hideShorts = settings["settings.hide.shorts"];
    }
    if (hideLives == null) {
        hideLives = settings["settings.hide.lives"];
    }
    if (hideMembersOnly == null) {
        hideMembersOnly = settings["settings.hide.members.only"];
    }
    if (hideCollabsUnsubscribed == null) {
        hideCollabsUnsubscribed = settings["settings.hide.collabs.unsubscribed"];
    }
    if (hideMostRelevant == null) {
        hideMostRelevant = settings["settings.hide.most.relevant"];
    }

    if (hideCollabsUnsubscribed && isSubscriptionsPage()) {
        buildSubscriptionCache();
    }
    // pageContext.js tells the channel exceptions which channel each card and the channel page belong to
    if (hidePremieres || hideLives || hideMembersOnly) {
        _injectPageContextScript();
    }

    // before buildUI() applies it and before the first hide pass, which may ask YouTube for more videos
    await loadStopLoadingOlder();
    if (run !== subsRun) {
        log("Initializing subs page... superseded by a navigation");
        return;
    }

    buildUI();

    // always scan: buttons and the other filters must reach late-loaded videos
    // even with hide watched off (shouldHide() already respects hideWatched)
    intervalId = window.setInterval(function () {
        try {
            removeWatchedAndAddButton();
        } catch (e) {
            logError(e);
        }
    }, settings["settings.hide.watched.refresh.rate"]);

    // YouTube renders the feed after this point and keeps adding cards on scroll; handle each card
    // as it appears instead of waiting for the next interval tick, which stays as a safety net
    if (feedObserver) {
        feedObserver.disconnect();
    }
    feedObserver = new MutationObserver(onFeedMutations);
    feedObserver.observe(document.body, {childList: true, subtree: true});

    removeWatchedAndAddButton();

    log("Initializing subs page... DONE");
}

// The exception list changed (here, in another tab or on another device): re-apply the filters
// while the feed is being handled
channelExceptionsChangedCallbacks.push(function () {
    if (feedObserver) {
        applyChannelExceptions();
    }
});

// pageContext.js tagged cards with their channel's id: cards hidden before it did may belong to a
// channel on the list by id. Not on a channel page, whose cards all belong to the page's channel.
// Once per frame: the page-world observer can send several of these while one batch renders.
let cardChannelsFrame = null;
document.addEventListener("ybs-card-channels", function () {
    if (cardChannelsFrame != null || !feedObserver || !hasIdOnlyChannelExceptions() || getCurrentChannel()) {
        return;
    }
    cardChannelsFrame = window.requestAnimationFrame(function () {
        cardChannelsFrame = null;
        try {
            showNewlyExemptCards();
        } catch (e) {
            logError(e);
        }
    });
});

// pageContext.js tagged <html> with the channel page's channel, read from YouTube's data
document.addEventListener("ybs-page-channel", function () {
    if (feedObserver) {
        pageChannelChanged();
    }
});

function stopSubs() {
    log("Stopping subs page behaviour");
    subsRun++;

    removeUI();
    window.clearInterval(intervalId);
    if (feedObserver) {
        feedObserver.disconnect();
        feedObserver = null;
    }
    if (feedSectionsFrame != null) {
        window.cancelAnimationFrame(feedSectionsFrame);
        feedSectionsFrame = null;
    }
}
