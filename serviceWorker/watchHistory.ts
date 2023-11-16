import brwsr from '../browser';
import {logError} from '../util';

import {log} from './common';

const VIDEO_WATCH_KEY = 'vw_';
// Storage sync set operations may be throttled https://developer.chrome.com/docs/extensions/reference/storage/#property-sync
const WATCHED_SYNC_THROTTLE = 1000;

let watchedVideos: Record<string, number> = {};
let loadedWatchHistory = false;

export function saveVideoOperation(operation: 'w' | 'n', videoId: string, now?: number) {
    if (operation !== 'w' && operation !== 'n') {
        return;
    }

    if (!loadedWatchHistory) {
        setTimeout(() => {
            saveVideoOperation(operation, videoId, now || Date.now());
        }, 500);

        return;
    }

    const videoOperation = `${operation}${videoId}`;
    if (watchedVideos[videoOperation]) {
        return;
    }

    now = now || Date.now();

    watchedVideos[videoOperation] = now;
    brwsr.storage.local.set({[videoOperation]: now});

    delete watchedVideos[(operation === 'w' ? 'n' : 'w') + videoId];
    brwsr.storage.local.remove((operation === 'w' ? 'n' : 'w') + videoId);

    syncWatchedVideos();
}

export async function loadWatchedVideos() {
    if (!brwsr.storage.onChanged.hasListener(onStorageChanged)) {
        brwsr.storage.onChanged.addListener(onStorageChanged);
    }

    const items = await brwsr.storage.sync.get(null);
    const batches: string[][] = [];

    for (const key in items) {
        if (key.indexOf(VIDEO_WATCH_KEY) !== 0) {
            continue;
        }
        const index = Number.parseInt(key.slice(VIDEO_WATCH_KEY.length));

        const watchedBatch = items[key];
        if (!Array.isArray(watchedBatch)) {
            logError(new Error(`Invalid watch history item ${key}`));
            continue;
        }
        batches[index] = watchedBatch as string[];
    }

    const operations: string[] = [];
    for (const batch of batches) {
        operations.push(...batch);
    }

    watchedVideos = (await brwsr.storage.local.get(null)) || {};
    loadedWatchHistory = true;

    const now = Date.now() - operations.length;
    for (const [index, operation] of operations.entries()) {
        saveVideoOperation(operation.slice(0, 1) as 'w' | 'n', operation.slice(1), now + index);
    }

    log(`Loaded ${Object.keys(watchedVideos).filter(key => key.length === 12).length} watched videos`);

    // old format
    const watchedVideoIds = Object.keys(watchedVideos).filter(key => key.length === 11);
    if (watchedVideoIds.length > 0) {
        for (const videoId of watchedVideoIds) {
            saveVideoOperation('w', videoId, watchedVideos[videoId]);
        }
        brwsr.storage.local.remove(watchedVideoIds);

        await syncWatchedVideos();
        log('Synced old format watch history');
    }
}

async function onStorageChanged(changes: browser.storage.ChangeDict, areaName: browser.storage.StorageName) {
    if (areaName !== 'sync') {
        return;
    }

    for (const key of Object.keys(changes || {})) {
        if (!key.startsWith(VIDEO_WATCH_KEY)) {
            continue;
        }

        await loadWatchedVideos();
        break;
    }
}

export async function getWatchedVideosHistory() {
    while (!loadedWatchHistory) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return watchedVideos;
}

export async function deleteWatchHistory() {
    watchedVideos = {};
    loadedWatchHistory = true;

    for (const key of Object.keys(await brwsr.storage.sync.get(null))) {
        if (key.startsWith(VIDEO_WATCH_KEY)) {
            brwsr.storage.sync.remove(key);
        }
    }

    await syncWatchedVideos();
}

let lastSyncUpdate = Date.now();
let syncUpdateTimeout: ReturnType<typeof setTimeout>;
export async function syncWatchedVideos() {
    if (!loadedWatchHistory || Date.now() - lastSyncUpdate < WATCHED_SYNC_THROTTLE) {
        clearTimeout(syncUpdateTimeout);
        syncUpdateTimeout = setTimeout(syncWatchedVideos, WATCHED_SYNC_THROTTLE - (Date.now() - lastSyncUpdate));
        return;
    }
    log('Update watch history sync storage');
    lastSyncUpdate = Date.now();

    const batches: Record<string, string[]> = {};
    let currentBatch: string[] = [];

    const sortedVideoOperations = (
        Object.keys(watchedVideos)
            .filter(key => key.length === 12 && typeof watchedVideos[key] === 'number')
            .sort((key1, key2) => watchedVideos[key2] - watchedVideos[key1])
    );

    for (const videoOperation of sortedVideoOperations) {
        const batchKey = VIDEO_WATCH_KEY + Object.keys(batches).length;

        const potentialBatch = [...currentBatch, videoOperation];
        const potentialBatchSize = JSON.stringify({
            [batchKey]: potentialBatch,
        }).length;

        if (JSON.stringify({
            ...batches,
            [batchKey]: potentialBatch,
        }).length > 100_000) {
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
        await brwsr.storage.sync.set(batches);
        lastSyncUpdate = Date.now();
    }
    catch (error) {
        console.error(error);
    }

    return (
        Object.values(batches)
            .map(batch => batch.length)
            .reduce((acc, batchLength) => acc + batchLength, 0)
    );
}
