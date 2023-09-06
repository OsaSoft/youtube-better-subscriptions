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

const watchedVideos = [];

async function loadWatchedVideos() {
    const items = await brwsr.storage.sync.get(null);
    const batches = [];

    for (const key in items) {
        if (key.indexOf(VIDEO_WATCH_KEY) !== 0) {
            continue;
        }
        const index = parseInt(key.slice(VIDEO_WATCH_KEY.length));

        const watchedBatch = items[key];
        if (!Array.isArray(watchedBatch)) {
            console.error('Invalid watch history item', key);
        }
        batches[index] = watchedBatch;
    }

    watchedVideos.splice(0, watchedVideos.length);
    for (const batch of batches) {
        watchedVideos.push(...batch);
    }

    const oldItems = await brwsr.storage.local.get(null);
    const sortedKeys = (
        Object.keys(oldItems)
            .filter(key => typeof oldItems[key] === 'number')
            .sort((key1, key2) => oldItems[key2] - oldItems[key1])
    );
    if (sortedKeys.length) {
        watchedVideos.unshift(...sortedKeys);

        console.log('Migrated old format watch history', sortedKeys.length);
        await brwsr.storage.local.remove(sortedKeys);
        await saveWatchedVideos();
    }
}

let lastSyncUpdate = Date.now();
let saveTimeout;
async function saveWatchedVideos() {
    if (Date.now() - lastSyncUpdate < WATCHED_SYNC_THROTTLE) {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveWatchedVideos, WATCHED_SYNC_THROTTLE - (Date.now() - lastSyncUpdate));
        return;
    }
    const batches = {};
    let currentBatch = [];

    for (const video of watchedVideos) {
        const key = VIDEO_WATCH_KEY + Object.keys(batches).length;
        const potentialBatchSize = JSON.stringify({
            [key]: [...currentBatch, video]
        }).length;

        // theoretical max size is 8192, but it's safer to have some margin
        if (potentialBatchSize >= 8000) {
            if (JSON.stringify({
                ...batches,
                [key]: currentBatch
            }).length > 100000) {
                // quota exhausted, older entries will be discarded
                break;
            }

            batches[key] = currentBatch;
            currentBatch = [];
        }

        currentBatch.push(video);
    }
    if (currentBatch.length > 0) {
        batches[VIDEO_WATCH_KEY + Object.keys(batches).length] = currentBatch;
    }

    try {
        await brwsr.storage.sync.set(batches);
        lastSyncUpdate = Date.now();
    }
    catch (error) {
        console.error(error || (typeof runtime !== 'undefined' && runtime.lastError));
    }
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
