const PREFIX = "osasoft-better-subscriptions_";

const DEFAULT_SETTINGS = {
    "settings.hide.watched.label": true,
    "settings.hide.watched.all.label": true,
    "settings.hide.watched.ui.stick.right": true,
    "settings.hide.watched.default": true,
    "settings.hide.watched.keep.state": true,
    "settings.hide.watched.refresh.rate": 3000,
    "settings.mark.watched.youtube.watched": false,
    "settings.log.level": 1,  // 1=ERROR, 2=WARN, 3=INFO, 4=DEBUG
    "settings.hide.watched.support.channel": true,
    "settings.hide.watched.support.home": true,
    "settings.hide.watched.auto.store": true,
    "settings.hide.premieres": false,
    "settings.hide.shorts": false,
    "settings.hide.lives": false,
    "settings.hide.members.only": false,
    "settings.hide.mark.watched.button": false,
    "settings.changelog.auto.open": true,
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

async function saveVideoOperation(videoOperation, now) {
    if (watchedVideos[videoOperation]) {
        return;
    }

    now = now || Date.now();

    const operation = videoOperation.slice(0, 1);
    const videoId = videoOperation.slice(1);

    watchedVideos[videoOperation] = now;
    brwsr.storage.local.set({[videoOperation]: now});

    delete watchedVideos[(operation === 'w' ? 'n' : 'w') + videoId];
    brwsr.storage.local.remove((operation === 'w' ? 'n' : 'w') + videoId);
}

async function watchVideo(videoId, now) {
    saveVideoOperation('w' + videoId, now);
}
function unwatchVideo(videoId, now) {
    saveVideoOperation('n' + videoId, now);
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
            if (timestamp !== null) {
                saveVideoOperation(operation, timestamp);
            } else {
                // Malformed v2 entry without timestamp — use current time
                saveVideoOperation(operation, Date.now());
            }
        }
    } else {
        // v1: assign synthetic timestamps preserving order (first in batches = newest)
        const now = Date.now();
        for (const [index, operation] of operations.entries()) {
            saveVideoOperation(operation, now - index);
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

let lastSyncUpdate = Date.now();
let saveTimeout;
let lastSyncError = null;

async function syncWatchedVideos() {
    if (Date.now() - lastSyncUpdate < WATCHED_SYNC_THROTTLE) {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(syncWatchedVideos, WATCHED_SYNC_THROTTLE - (Date.now() - lastSyncUpdate));
        return;
    }
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
        }).length > 100000) {
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
        // Get existing batch keys to clean up stale ones after write
        const existingSyncData = await syncStorageGet(null) || {};
        const existingBatchKeys = Object.keys(existingSyncData)
            .filter(key => key.indexOf(VIDEO_WATCH_KEY) === 0);

        const existingMeta = existingSyncData[SYNC_META_KEY];
        if (existingMeta && existingMeta.clearedAt) {
            batches[SYNC_META_KEY].clearedAt = existingMeta.clearedAt;
        }

        // Write new batches
        await new Promise((resolve, reject) => {
            brwsr.storage.sync.set(batches, () => {
                if (brwsr.runtime.lastError) {
                    reject(new Error(brwsr.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });

        // Remove old batch keys that are no longer needed (preserve vw_meta)
        const newBatchKeys = Object.keys(batches);
        const keysToRemove = existingBatchKeys.filter(key => key !== SYNC_META_KEY && !newBatchKeys.includes(key));
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
