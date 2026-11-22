// Channel exceptions (#280): channels whose premieres, live streams and members-only videos stay
// visible while "Hide Premieres", "Hide currently live streams" and "Hide members-only content" hide
// them from every other channel. Loaded by the content scripts and by the settings page.
//
// Stored in storage.sync under its own key, not in the "settings" object: the settings page saves
// that object from its form fields, which would drop a list edited from a channel page.
//
// Each entry is one string that names the channel by its id, its handle, or both:
//   "UCXuqSBlHAE6Xw-yeJA0Tunw@linustechtips"   id and handle (added from the channel page)
//   "@linustechtips"                            handle only (added as @handle or youtube.com/@handle)
//   "UCXuqSBlHAE6Xw-yeJA0Tunw"                  id only (added as youtube.com/channel/UC…)
// Handles are stored lowercased (YouTube treats them case-insensitively), ids as they are (they are
// case-sensitive). "@" can't occur in either, so it separates them. Strings rather than objects keep
// the list small: watch history fills sync storage up to its quota, leaving little room for it.

// storage.sync key. Not "vw_…" (watch history batches) and not 11 or 12 characters long, which
// loadWatchedVideos() would read as a video if it ever ended up in storage.local.
const CHANNEL_EXCEPTIONS_KEY = "channel_exceptions";
// Caps that keep the list inside the room watch history leaves free in sync storage: an entry takes
// 15-60 bytes (an id is 24 characters, a handle up to 30 letters of up to 3 bytes each in UTF-8).
// syncWatchedVideos() reserves MAX_CHANNEL_EXCEPTIONS_BYTES for it (SYNC_RESERVED_BYTES in common.js).
const MAX_CHANNEL_EXCEPTIONS = 25;
const MAX_CHANNEL_EXCEPTIONS_BYTES = 1024;

const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
// letters (any script), digits, underscore, hyphen, period and middle dot; 3-30 characters
const HANDLE_PATTERN = /^[\p{L}\p{M}\p{N}_.\-·]{3,30}$/u;

let channelExceptions = [];
let channelExceptionsChangedCallbacks = [];

function normalizeHandle(handle) {
    if (typeof handle !== "string") {
        return null;
    }
    let decoded = handle;
    try {
        decoded = decodeURIComponent(handle);
    } catch (e) {
        // not percent-encoded after all
    }
    decoded = decoded.trim().replace(/^@/, "").toLowerCase();
    return HANDLE_PATTERN.test(decoded) ? decoded : null;
}

function normalizeChannelId(id) {
    return typeof id === "string" && CHANNEL_ID_PATTERN.test(id) ? id : null;
}

function makeChannel(id, handle) {
    id = normalizeChannelId(id);
    handle = normalizeHandle(handle);
    return id || handle ? {id: id, handle: handle} : null;
}

// The channel a YouTube path belongs to: "/@handle…" or "/channel/UC…", followed by anything
// (a tab such as /videos), or null for any other path
function channelFromPath(path) {
    if (typeof path !== "string") {
        return null;
    }
    let segments = path.split(/[?#]/)[0].split("/");
    if (segments[0] !== "") {
        return null;
    }
    if (segments[1] && segments[1][0] === "@") {
        let handle = normalizeHandle(segments[1].slice(1));
        return handle ? {id: null, handle: handle} : null;
    }
    if (segments[1] === "channel") {
        let id = normalizeChannelId(segments[2]);
        return id ? {id: id, handle: null} : null;
    }
    return null;
}

function isYouTubeHost(hostname) {
    return hostname === "youtube.com" || hostname.endsWith(".youtube.com");
}

// The channel a link points to: a path ("/@handle", "/channel/UC…") or a youtube.com URL
function channelFromHref(href) {
    if (typeof href !== "string" || href === "") {
        return null;
    }
    if (href[0] === "/" && href[1] !== "/") {
        return channelFromPath(href);
    }
    try {
        let url = new URL(href);
        return isYouTubeHost(url.hostname) ? channelFromPath(url.pathname) : null;
    } catch (e) {
        return null;
    }
}

// What a user typed into the settings page: "@handle", "handle", "UC…" or a channel URL with or
// without the scheme ("youtube.com/@handle", "https://www.youtube.com/channel/UC…/videos").
// Returns {id, handle} or null when it doesn't name a channel (e.g. a /c/ or /user/ URL, a video).
function parseChannelInput(input) {
    if (typeof input !== "string") {
        return null;
    }
    let text = input.trim();
    if (text === "" || /\s/.test(text)) {
        return null;
    }
    if (CHANNEL_ID_PATTERN.test(text)) {
        return {id: text, handle: null};
    }
    if (text[0] === "@") {
        let handle = normalizeHandle(text.split(/[/?#]/)[0]);
        return handle ? {id: null, handle: handle} : null;
    }
    if (text[0] === "/") {
        return channelFromPath(text);
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) || /^([a-z0-9-]+\.)*youtube\.com([/?#]|$)/i.test(text)) {
        return channelFromHref(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : "https://" + text);
    }
    // a bare handle without the "@"
    let handle = normalizeHandle(text);
    return handle ? {id: null, handle: handle} : null;
}

function formatChannelException(channel) {
    return (channel.id || "") + (channel.handle ? "@" + channel.handle : "");
}

function parseChannelException(entry) {
    if (typeof entry !== "string") {
        return null;
    }
    let at = entry.indexOf("@");
    return at === -1 ? makeChannel(entry, null) : makeChannel(entry.slice(0, at) || null, entry.slice(at + 1));
}

// The stored list without anything that isn't a valid entry, so a damaged value can't break hiding
function normalizeChannelExceptions(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    let entries = [];
    for (let entry of value) {
        let channel = parseChannelException(entry);
        if (channel) {
            entries.push(formatChannelException(channel));
        }
    }
    return entries;
}

// Same channel when the ids match or the handles match (case-insensitively, both are normalized)
function sameChannel(a, b) {
    return Boolean(a && b && ((a.id && b.id && a.id === b.id) || (a.handle && b.handle && a.handle === b.handle)));
}

function findChannelExceptionIndex(list, channel) {
    return list.findIndex(entry => sameChannel(parseChannelException(entry), channel));
}

function isChannelInExceptions(list, channel) {
    return Boolean(channel) && findChannelExceptionIndex(list, channel) !== -1;
}

// The size of the stored list in sync storage, in bytes as the quota counts them
function getChannelExceptionsBytes(list) {
    return syncItemBytes(CHANNEL_EXCEPTIONS_KEY, list);
}

// Adds the channel, or completes its entry with an id or handle it lacked. Returns the new list and
// whether it changed; throws when the list is full.
function addChannelException(list, channel) {
    if (findChannelExceptionIndex(list, channel) !== -1) {
        return completeChannelException(list, channel);
    }
    if (list.length >= MAX_CHANNEL_EXCEPTIONS) {
        throw new Error("The exception list is full (" + MAX_CHANNEL_EXCEPTIONS + " channels). Remove a channel first.");
    }
    let updated = [...list, formatChannelException(channel)];
    if (getChannelExceptionsBytes(updated) > MAX_CHANNEL_EXCEPTIONS_BYTES) {
        throw new Error("The exception list is full (it may take " + MAX_CHANNEL_EXCEPTIONS_BYTES +
            " bytes of sync storage). Remove a channel first.");
    }
    return {list: updated, changed: true};
}

// Completes the channel's entry with the id or handle it lacked, and folds into it any other entry
// naming the same channel (e.g. its id added from a /channel/ URL and its @handle from the switch).
// Never adds a channel, and leaves the list as it is rather than grow it over the size cap.
function completeChannelException(list, channel) {
    let index = findChannelExceptionIndex(list, channel);
    if (index === -1) {
        return {list: list, changed: false};
    }
    let existing = parseChannelException(list[index]);
    let merged = {id: existing.id || channel.id, handle: existing.handle || channel.handle};
    let updated = list
        .map((entry, i) => i === index ? formatChannelException(merged) : entry)
        .filter((entry, i) => i === index || !sameChannel(parseChannelException(entry), merged));
    if (updated.length === list.length && updated.every((entry, i) => entry === list[i])) {
        return {list: list, changed: false};
    }
    if (getChannelExceptionsBytes(updated) > MAX_CHANNEL_EXCEPTIONS_BYTES &&
            getChannelExceptionsBytes(updated) > getChannelExceptionsBytes(list)) {
        return {list: list, changed: false};
    }
    return {list: updated, changed: true};
}

function removeChannelException(list, channel) {
    return list.filter(entry => !sameChannel(parseChannelException(entry), channel));
}

// Whether the filters for premieres, live streams and members-only skip this channel
function isChannelExempt(channel) {
    return channelExceptions.length > 0 && isChannelInExceptions(channelExceptions, channel);
}

function hasChannelExceptions() {
    return channelExceptions.length > 0;
}

// Whether an entry names its channel by id only: feed cards link the handle, so they match it only
// once pageContext.js has tagged them with the id
function hasIdOnlyChannelExceptions() {
    return channelExceptions.some(entry => entry.indexOf("@") === -1);
}

// --- The current page's channel ---

// The part of a channel page's path that names the channel ("/@handle", "/channel/UC…", or the
// legacy "/c/Name" and "/user/Name"), or null when the path isn't a channel page
function channelPagePrefix(path) {
    if (typeof path !== "string") {
        return null;
    }
    let segments = path.split(/[?#]/)[0].split("/");
    if (segments[0] !== "" || !segments[1]) {
        return null;
    }
    if (segments[1][0] === "@") {
        return "/" + segments[1];
    }
    if (["channel", "c", "user"].includes(segments[1]) && segments[2]) {
        return "/" + segments[1] + "/" + segments[2];
    }
    return null;
}

// a with the half it lacks from b, unless they disagree on a half both name
function mergeChannels(a, b) {
    if (!a || !b) {
        return a || b;
    }
    if ((a.id && b.id && a.id !== b.id) || (a.handle && b.handle && a.handle !== b.handle)) {
        return a;
    }
    return {id: a.id || b.id, handle: a.handle || b.handle};
}

// The channel pageContext.js read from YouTube's data for the channel page (data-ybs-page-channel-*
// on <html>), while still on the page it was read for: it stamps the path, and clears it all when
// a navigation starts
function getPageWorldChannel(prefix) {
    let data = document.documentElement.dataset;
    if (!data.ybsPageChannelPath || channelPagePrefix(data.ybsPageChannelPath) !== prefix) {
        return null;
    }
    let fromUrl = channelFromHref(data.ybsPageChannelUrl || "");
    return makeChannel(data.ybsPageChannelId || null, fromUrl ? fromUrl.handle : null);
}

function getCanonicalChannel() {
    let link = document.querySelector('link[rel="canonical"]');
    return link ? channelFromHref(link.getAttribute("href")) : null;
}

// The canonical link describes the page the document was loaded for. It's read once, now, and only
// used while still on that page's channel: whatever YouTube does to the tag during its in-page
// navigation can't then put another channel's id into a synced entry.
const INITIAL_PAGE_PREFIX = channelPagePrefix(window.location.pathname);
const INITIAL_CANONICAL_CHANNEL = INITIAL_PAGE_PREFIX ? getCanonicalChannel() : null;

// The channel whose page this is, or null when this isn't a channel page: the URL's handle or id,
// completed from YouTube's data (pageContext.js) and, on the page loaded first, the canonical link,
// where they agree with the URL. On a /c/ or /user/ page only those two know the channel.
function getCurrentChannel() {
    let path = window.location.pathname;
    let prefix = channelPagePrefix(path);
    if (!prefix) {
        return null;
    }
    let channel = mergeChannels(channelFromPath(path), getPageWorldChannel(prefix));
    if (prefix === INITIAL_PAGE_PREFIX) {
        channel = mergeChannels(channel, INITIAL_CANONICAL_CHANNEL);
    }
    return channel;
}

// --- Storage ---

async function loadChannelExceptions() {
    let items = await new Promise(resolve => brwsr.storage.sync.get(CHANNEL_EXCEPTIONS_KEY, resolve));
    channelExceptions = normalizeChannelExceptions(items && items[CHANNEL_EXCEPTIONS_KEY]);
    return channelExceptions;
}

function saveChannelExceptions(list) {
    return new Promise((resolve, reject) => {
        brwsr.storage.sync.set({[CHANNEL_EXCEPTIONS_KEY]: list}, () => {
            if (brwsr.runtime.lastError) {
                reject(new Error(brwsr.runtime.lastError.message));
            } else {
                channelExceptions = list;
                resolve(list);
            }
        });
    });
}

// Read-modify-write from storage, so an edit made in another tab or on another device isn't lost.
// update(list) returns the new list, or the same list for no change.
async function updateChannelExceptions(update) {
    let list = await loadChannelExceptions();
    let updated = update(list);
    if (updated === list) {
        return list;
    }
    return saveChannelExceptions(updated);
}

brwsr.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !(CHANNEL_EXCEPTIONS_KEY in changes)) {
        return;
    }
    channelExceptions = normalizeChannelExceptions(changes[CHANNEL_EXCEPTIONS_KEY].newValue);
    for (let callback of channelExceptionsChangedCallbacks) {
        try {
            callback(channelExceptions);
        } catch (e) {
            logError(e);
        }
    }
});
