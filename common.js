const PREFIX = "osasoft-better-subscriptions_";

const DEFAULT_SETTINGS = {
    "settings.hide.watched.label": true,
    "settings.hide.watched.all.label": true,
    "settings.hide.watched.ui.stick.right": true,
    "settings.hide.watched.default": true,
    "settings.hide.watched.keep.state": true,
    "settings.hide.watched.refresh.rate": 3000,
    "settings.mark.watched.youtube.watched": false,
    "settings.log.level": 1, // 1=ERROR, 2=WARN, 3=INFO, 4=DEBUG
    "settings.hide.watched.support.channel": true,
    "settings.hide.watched.support.home": true,
    "settings.hide.watched.support.playlist": true,
    "settings.hide.watched.auto.store": true,
    "settings.hide.premieres": false,
    "settings.hide.shorts": false,
    "settings.hide.lives": false,
    "settings.hide.members.only": false,
    "settings.hide.collabs.unsubscribed": false,
    "settings.hide.duration.shorter": false,
    "settings.hide.duration.shorter.minutes": 10,
    "settings.hide.duration.longer": false,
    "settings.hide.duration.longer.minutes": 120,
    "settings.hide.title.patterns": "", // one pattern per line, see parseTitlePatterns()
    "settings.hide.most.relevant": false,
    "settings.hide.mark.watched.button": false,
    "settings.mark.watched.button.compact": true,
    "settings.changelog.auto.open": true,
    "settings.stop.loading.button.style": "icon-text", // text | icon-text | icon | off
};

const SETTINGS_KEY = "settings";
const SETTINGS_LOCAL_KEY = "settings_cache";
const VIDEO_WATCH_KEY = "vw_";

// Storage sync set operations may be throttled https://developer.chrome.com/docs/extensions/reference/storage/#property-sync
const WATCHED_SYNC_THROTTLE = 1000;

// Sync format v2: embed real timestamps in sync entries
const SYNC_FORMAT_VERSION = 2;
const SYNC_META_KEY = "vw_meta";
const CLEAR_SENTINEL_KEY = "vw_last_cleared";

// browser.storage.sync total quota (same in Chrome and Firefox)
const SYNC_QUOTA_BYTES = 102400;
// The most the title patterns (#70) may take in the settings item in sync storage, as UTF-8 bytes of
// the JSON string (a backslash counts twice)
const MAX_TITLE_PATTERNS_BYTES = 1024;
// Room syncWatchedVideos() keeps free on top of what the other keys take: the channel exception list
// may still grow to its cap (MAX_CHANNEL_EXCEPTIONS_BYTES in channelExceptions.js), the title patterns
// to theirs, plus some slack for the other settings to grow
const SYNC_RESERVED_BYTES = 1024 + MAX_TITLE_PATTERNS_BYTES + 512;
// syncWatchedVideos() fills the quota with watch history up to that reserve, so sync storage above
// this threshold means older videos were dropped because of the quota
const SYNC_QUOTA_NEARLY_FULL_BYTES = SYNC_QUOTA_BYTES * 0.95;

// --- Title patterns (#70) ---
// One pattern per line, each a JavaScript regular expression matched case-insensitively anywhere in
// the title (so a plain word works too). Blank lines and spaces at either end of a line are ignored.
// An invalid line, or one that matches an empty string (so every title, e.g. "trailer|"), is
// reported and skipped, never thrown.

// {patterns: [{line, source, regex}], errors: [{line, source, message}]}, lines numbered from 1
function parseTitlePatterns(text) {
    const patterns = [];
    const errors = [];
    if (typeof text !== "string") {
        return {patterns, errors};
    }
    text.split(/\r?\n/).forEach((rawLine, index) => {
        const source = rawLine.trim();
        if (source === "") {
            return;
        }
        let regex;
        try {
            // "i" only: "g" or "y" would make test() remember where it stopped
            regex = new RegExp(source, "i");
        } catch (e) {
            // the browser's reason, without its "Invalid regular expression: /…/i:" prefix
            errors.push({line: index + 1, source, message: e.message.replace(/^Invalid regular expression: \/.*\/[a-z]*: /s, "")});
            return;
        }
        if (regex.test("")) {
            // it would hide every video, and the feed would keep loading older ones to fill up
            errors.push({line: index + 1, source, message: "it matches every title"});
            return;
        }
        patterns.push({line: index + 1, source, regex});
    });
    return {patterns, errors};
}

// The bytes the patterns text takes in the settings item in sync storage
function getTitlePatternsBytes(text) {
    return utf8ByteLength(JSON.stringify(typeof text === "string" ? text : ""));
}

// Compiled once per patterns text, not per card per scan: settings is replaced as a whole when it
// loads or changes, so the text itself is the cache key
let compiledTitlePatternsSource = null;
let compiledTitlePatterns = [];

function getTitlePatterns(text) {
    const source = typeof text === "string" ? text : "";
    if (source !== compiledTitlePatternsSource) {
        compiledTitlePatternsSource = source;
        compiledTitlePatterns = parseTitlePatterns(source).patterns.map(pattern => pattern.regex);
    }
    return compiledTitlePatterns;
}

// Whether a title matches one of the patterns in the text; an empty or missing title never does
function matchesTitlePattern(title, text) {
    if (typeof title !== "string" || title.trim() === "") {
        return false;
    }
    return getTitlePatterns(text).some(regex => regex.test(title));
}

function isVideoKey(key) {
    return key.length === 12 && (key[0] === 'w' || key[0] === 'n');
}

function encodeTimestamp(ms) {
    return Math.floor(ms / 1000).toString(36);
}

function decodeTimestamp(str) {
    return parseInt(str, 36) * 1000;
}

function packSyncEntry(operation, timestampMs) {
    return operation + ':' + encodeTimestamp(timestampMs);
}

function unpackSyncEntry(entry) {
    if (typeof entry !== 'string') {
        logWarn("Invalid sync entry (expected string, got " + typeof entry + ")");
        return { operation: null, timestamp: null };
    }
    const colonIndex = entry.indexOf(':');
    if (colonIndex === -1) {
        // v1 format: no timestamp embedded
        return { operation: entry, timestamp: null };
    }
    return {
        operation: entry.slice(0, colonIndex),
        timestamp: decodeTimestamp(entry.slice(colonIndex + 1))
    };
}

let brwsr;
try {
    brwsr = browser;
} catch (e) {
    if (e instanceof ReferenceError) {
        brwsr = chrome;
    }
}

let watchedVideos = {};

async function syncStorageGet(keys) {
    return new Promise((resolve) => {
        brwsr.storage.sync.get(keys, resolve);
    });
}
async function localStorageGet(keys) {
    return new Promise((resolve) => {
        brwsr.storage.local.get(keys, resolve);
    });
}

// 'wVIDEO_ID' <-> 'nVIDEO_ID'
function getOppositeOperation(videoOperation) {
    return (videoOperation[0] === 'w' ? 'n' : 'w') + videoOperation.slice(1);
}

async function saveVideoOperation(videoOperation, now) {
    if (watchedVideos[videoOperation]) {
        return;
    }

    now = now || Date.now();

    watchedVideos[videoOperation] = now;
    brwsr.storage.local.set({[videoOperation]: now});

    const oppositeOperation = getOppositeOperation(videoOperation);
    delete watchedVideos[oppositeOperation];
    brwsr.storage.local.remove(oppositeOperation);
}

async function watchVideo(videoId, now) {
    saveVideoOperation('w' + videoId, now);
}
function unwatchVideo(videoId, now) {
    saveVideoOperation('n' + videoId, now);
}

// Applies an operation coming from sync storage, unless this device has a newer opposite operation
// (e.g. a stale "watched" from another device must not revert a newer local "unwatched").
// syncedTimestamp is null when sync has no real timestamp (v1 or malformed entry) - such entries
// never override local state and are stored with fallbackTimestamp.
function mergeSyncedVideoOperation(videoOperation, syncedTimestamp, fallbackTimestamp) {
    const oppositeOperation = getOppositeOperation(videoOperation);
    const oppositeTimestamp = watchedVideos[oppositeOperation];

    if (typeof oppositeTimestamp === 'number') {
        if (syncedTimestamp === null) {
            return;
        }
        // Sync only stores whole seconds, so compare at that precision. On a tie every device keeps
        // "watched", so devices converge instead of each keeping its own operation.
        const localSeconds = Math.floor(oppositeTimestamp / 1000);
        const syncedSeconds = Math.floor(syncedTimestamp / 1000);
        if (localSeconds > syncedSeconds || (localSeconds === syncedSeconds && oppositeOperation[0] === 'w')) {
            return;
        }
    }

    saveVideoOperation(videoOperation, syncedTimestamp !== null ? syncedTimestamp : fallbackTimestamp);
}

async function loadWatchedVideos() {
    const items = await syncStorageGet(null) || {};
    const batches = [];

    // Detect sync format version
    const meta = items[SYNC_META_KEY];
    const syncVersion = (meta && meta.version) || 1;

    for (const key in items) {
        if (key === SYNC_META_KEY) {
            continue;
        }
        if (key.indexOf(VIDEO_WATCH_KEY) !== 0) {
            continue;
        }
        const index = parseInt(key.slice(VIDEO_WATCH_KEY.length));

        const watchedBatch = items[key];
        if (!Array.isArray(watchedBatch)) {
            logWarn("Invalid watch history item: " + key);
            continue;
        }
        batches[index] = watchedBatch;
    }

    const operations = [];
    for (const batch of batches) {
        if (!batch) continue;
        operations.push(...batch);
    }

    watchedVideos = (await localStorageGet(null)) || {};

    const clearedAt = (meta && meta.clearedAt) || 0;
    const lastCleared = watchedVideos[CLEAR_SENTINEL_KEY] || 0;
    if (clearedAt > lastCleared) {
        const localVideoKeys = Object.keys(watchedVideos).filter(isVideoKey);
        for (const key of localVideoKeys) {
            delete watchedVideos[key];
        }
        brwsr.storage.local.remove(localVideoKeys);
        watchedVideos[CLEAR_SENTINEL_KEY] = clearedAt;
        brwsr.storage.local.set({ [CLEAR_SENTINEL_KEY]: clearedAt });
    }

    if (syncVersion >= 2) {
        // v2: extract real timestamps from packed entries
        for (const entry of operations) {
            const { operation, timestamp } = unpackSyncEntry(entry);
            if (!operation) continue;
            // Malformed v2 entry without timestamp falls back to current time
            mergeSyncedVideoOperation(operation, timestamp, Date.now());
        }
    } else {
        // v1: assign synthetic timestamps preserving order (first in batches = newest)
        const now = Date.now();
        for (const [index, operation] of operations.entries()) {
            mergeSyncedVideoOperation(operation, null, now - index);
        }
    }

    // old format
    const watchedVideoIds = Object.keys(watchedVideos).filter(key => key.length === 11);
    if (watchedVideoIds.length > 0) {
        for (const videoId of watchedVideoIds) {
            saveVideoOperation('w' + videoId, watchedVideos[videoId]);
        }
        brwsr.storage.local.remove(watchedVideoIds);

        await syncWatchedVideos();
        log("Synced old format watch history");
    }
}

// How many bytes watch history may take in sync storage: the quota less what the other keys (settings,
// channel exceptions) take now and SYNC_RESERVED_BYTES. A write over the quota fails as a whole, so
// history must leave them room.
function getSyncHistoryBudget(syncData) {
    const quota = (brwsr.storage.sync && brwsr.storage.sync.QUOTA_BYTES) || SYNC_QUOTA_BYTES;
    let otherBytes = 0;
    for (const key in syncData) {
        if (key.indexOf(VIDEO_WATCH_KEY) !== 0) {
            otherBytes += syncItemBytes(key, syncData[key]);
        }
    }
    return quota - otherBytes - SYNC_RESERVED_BYTES;
}

let lastSyncUpdate = Date.now();
let saveTimeout;
let lastSyncError = null;

async function syncWatchedVideos() {
    if (Date.now() - lastSyncUpdate < WATCHED_SYNC_THROTTLE) {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(syncWatchedVideos, WATCHED_SYNC_THROTTLE - (Date.now() - lastSyncUpdate));
        return;
    }
    // Get existing keys: the other keys' size sets the room left for history, and stale batch keys
    // are cleaned up after the write
    const existingSyncData = await syncStorageGet(null) || {};
    const historyBudget = getSyncHistoryBudget(existingSyncData);

    const batches = { [SYNC_META_KEY]: { version: SYNC_FORMAT_VERSION } };
    let currentBatch = [];
    let batchCount = 0;
    let droppedCount = 0;

    const sortedVideoOperations = (
        Object.keys(watchedVideos)
            .filter(key => isVideoKey(key) && typeof watchedVideos[key] === 'number')
            .sort((key1, key2) => watchedVideos[key2] - watchedVideos[key1])
    );

    for (const videoOperation of sortedVideoOperations) {
        const batchKey = VIDEO_WATCH_KEY + batchCount;
        const packedEntry = packSyncEntry(videoOperation, watchedVideos[videoOperation]);

        const potentialBatch = [...currentBatch, packedEntry];
        const potentialBatchSize = JSON.stringify({
            [batchKey]: potentialBatch
        }).length;

        if (JSON.stringify({
            ...batches,
            [batchKey]: potentialBatch
        }).length > historyBudget) {
            // quota exhausted, count remaining as dropped
            const syncedSoFar = Object.values(batches)
                .filter(v => Array.isArray(v))
                .reduce((sum, b) => sum + b.length, 0);
            droppedCount = sortedVideoOperations.length - syncedSoFar - currentBatch.length;
            break;
        }

        // theoretical max size is 8192, but it's safer to have some margin
        if (potentialBatchSize >= 8000) {
            batches[batchKey] = currentBatch;
            batchCount++;
            currentBatch = [];
        }

        currentBatch.push(packedEntry);
    }
    if (currentBatch.length > 0) {
        batches[VIDEO_WATCH_KEY + batchCount] = currentBatch;
    }

    try {
        const existingBatchKeys = Object.keys(existingSyncData)
            .filter(key => key.indexOf(VIDEO_WATCH_KEY) === 0);

        const existingMeta = existingSyncData[SYNC_META_KEY];
        if (existingMeta && existingMeta.clearedAt) {
            batches[SYNC_META_KEY].clearedAt = existingMeta.clearedAt;
        }

        // Old batch keys this write doesn't replace are emptied in it: with history's room set by the
        // other keys, there may be fewer batches than before, and the old content of the rest must not
        // count against the quota while the write is checked. They're removed after it.
        const newBatchKeys = Object.keys(batches);
        const keysToRemove = existingBatchKeys.filter(key => key !== SYNC_META_KEY && !newBatchKeys.includes(key));
        const written = { ...batches };
        for (const key of keysToRemove) {
            written[key] = [];
        }

        // Write new batches
        await new Promise((resolve, reject) => {
            brwsr.storage.sync.set(written, () => {
                if (brwsr.runtime.lastError) {
                    reject(new Error(brwsr.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });

        // Remove old batch keys that are no longer needed (preserve vw_meta)
        if (keysToRemove.length > 0) {
            await new Promise((resolve, reject) => {
                brwsr.storage.sync.remove(keysToRemove, () => {
                    if (brwsr.runtime.lastError) {
                        reject(new Error(brwsr.runtime.lastError.message));
                    } else {
                        resolve();
                    }
                });
            });
        }

        lastSyncUpdate = Date.now();
        lastSyncError = null;
    }
    catch (error) {
        lastSyncError = error.message;
        logError({message: "Sync failed: " + error.message, stack: error?.stack || ""});
        throw error;
    }

    const syncedCount = Object.values(batches)
        .filter(v => Array.isArray(v))
        .reduce((acc, batch) => acc + batch.length, 0);

    if (droppedCount > 0) {
        logWarn("Sync quota full: " + droppedCount + " older videos not synced");
    }

    return syncedCount;
}

// Explains why this device has more videos than sync storage, or returns null when it doesn't
function getSyncCountWarning(localVideoCount, syncVideoCount, syncBytes) {
    if (localVideoCount <= syncVideoCount) {
        return null;
    }

    const notSynced = localVideoCount - syncVideoCount;
    if (syncBytes >= SYNC_QUOTA_NEARLY_FULL_BYTES) {
        return "Warning: " + notSynced + " videos not synced due to storage quota limit. " +
            "These older videos will only exist on this device. Use 'Clear oldest videos' to free up space.";
    }

    return notSynced + " videos on this device are not in sync storage yet. " +
        "Your browser may not have finished syncing with your other devices - wait a few minutes " +
        "or trigger a sync manually (Firefox: account menu > Sync Now). " +
        "Avoid 'Force Pull' until the counts match, as it would replace this device's history with sync storage.";
}

async function clearOldestVideos(count) {
    const sortedByAge = Object.keys(watchedVideos)
        .filter(key => isVideoKey(key) && typeof watchedVideos[key] === 'number')
        .sort((a, b) => watchedVideos[a] - watchedVideos[b]);  // Oldest first

    const toRemove = sortedByAge.slice(0, count);

    for (const key of toRemove) {
        delete watchedVideos[key];
    }

    // Remove from local storage
    await new Promise(resolve => {
        brwsr.storage.local.remove(toRemove, () => {
            if (brwsr.runtime && brwsr.runtime.lastError) {
                console.error("Failed to remove watched videos from local storage:", toRemove, brwsr.runtime.lastError);
            }
            resolve();
        });
    });

    // Sync the changes
    await syncWatchedVideos();

    return toRemove.length;
}

brwsr.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') {
        return;
    }

    loadWatchedVideos();
});

function getCurrentPage() {
    let path = window.location.pathname;
    if (path != null) {
        return path.replace(/\/$/, "");
    }

    return "";
}

function isSubscriptionsPage() {
    return getCurrentPage() === "/feed/subscriptions";
}
