const PREFIX = "osasoft-better-subscriptions_";

const DEFAULT_SETTINGS = {
    "settings.hide.watched.label": true,
    "settings.hide.watched.all.label": true,
    "settings.hide.watched.ui.stick.right": false,
    "settings.hide.watched.default": true,
    "settings.hide.watched.keep.state": true,
    "settings.hide.watched.refresh.rate": 3000,
    "settings.mark.watched.youtube.watched": false,
    "settings.log.enabled": false,
    "settings.hide.watched.support.channel": true,
    "settings.hide.watched.support.home": true,
    "settings.hide.watched.auto.store": true,
    "settings.hide.premieres": false,
    "settings.hide.shorts": false,
    "settings.hide.older": true,
    "settings.hide.older.cutoff":"1 Week"
};

const SETTINGS_KEY = "settings";
const VIDEO_WATCH_KEY = "vw_";

// Storage sync set operations may be throttled https://developer.chrome.com/docs/extensions/reference/storage/#property-sync
const WATCHED_SYNC_THROTTLE = 1000;

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
    const items = await syncStorageGet(null);
    const batches = [];

    for (const key in items) {
        if (key.indexOf(VIDEO_WATCH_KEY) !== 0) {
            continue;
        }
        const index = parseInt(key.slice(VIDEO_WATCH_KEY.length));

        const watchedBatch = items[key];
        if (!Array.isArray(watchedBatch)) {
            console.error('Invalid watch history item', key);
            continue;
        }
        batches[index] = watchedBatch;
    }

    const operations = [];
    for (const batch of batches) {
        operations.push(...batch);
    }

    watchedVideos = (await localStorageGet(null)) || {};

    const now = Date.now() - operations.length;
    for (const [index, operation] of operations.entries()) {
        saveVideoOperation(operation, now + index);
    }

    // old format
    const watchedVideoIds = Object.keys(watchedVideos).filter(key => key.length === 11);
    if (watchedVideoIds.length > 0) {
        for (const videoId of watchedVideoIds) {
            saveVideoOperation('w' + videoId, watchedVideos[videoId]);
        }
        brwsr.storage.local.remove(watchedVideoIds);

        await syncWatchedVideos();
        console.log('Synced old format watch history');
    }
}

let lastSyncUpdate = Date.now();
let saveTimeout;
async function syncWatchedVideos() {
    if (Date.now() - lastSyncUpdate < WATCHED_SYNC_THROTTLE) {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(syncWatchedVideos, WATCHED_SYNC_THROTTLE - (Date.now() - lastSyncUpdate));
        return;
    }
    const batches = {};
    let currentBatch = [];

    const sortedVideoOperations = (
        Object.keys(watchedVideos)
            .filter(key => key.length === 12 && typeof watchedVideos[key] === 'number')
            .sort((key1, key2) => watchedVideos[key2] - watchedVideos[key1])
    );

    for (const videoOperation of sortedVideoOperations) {
        const batchKey = VIDEO_WATCH_KEY + Object.keys(batches).length;

        const potentialBatch = [...currentBatch, videoOperation];
        const potentialBatchSize = JSON.stringify({
            [batchKey]: potentialBatch
        }).length;

        if (JSON.stringify({
            ...batches,
            [batchKey]: potentialBatch
        }).length > 100000) {
            // quota exhausted, older entries will be discarded
            break;
        }

        // theoretical max size is 8192, but it's safer to have some margin
        if (potentialBatchSize >= 8000) {
            batches[batchKey] = currentBatch;
            currentBatch = [];
        }

        currentBatch.push(videoOperation);
    }
    if (currentBatch.length > 0) {
        batches[VIDEO_WATCH_KEY + Object.keys(batches).length] = currentBatch;
    }

    try {
        await new Promise(resolve => {
            brwsr.storage.sync.set(batches, resolve);
        });
        lastSyncUpdate = Date.now();
    }
    catch (error) {
        console.error(error || (typeof runtime !== 'undefined' && runtime.lastError));
    }

    return Object.values(batches).map(batch => batch.length).reduce((acc, batchLength) => acc + batchLength, 0);
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
