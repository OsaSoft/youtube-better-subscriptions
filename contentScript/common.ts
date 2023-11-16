import brwsr from '../browser';
import {IContentScriptToServiceWorkerPayload, IServiceWorkerToContentScriptPayload, TypedPort} from '../port';
import {PREFIX, prepareMessage} from '../util';

import {getSettings} from './settings';

let localWatchHistory: Record<string, number> = {};
let loadedWatchHistory = false;

export function setLocalWatchHistory(newWatchHistory: typeof localWatchHistory): void {
    localWatchHistory = newWatchHistory;
    loadedWatchHistory = true;
}
export function isVideoIdWatched(videoId: string): boolean {
    return !!localWatchHistory['w' + videoId];
}

export function applyLocalVideoOperation(operation: 'w' | 'n', videoId: string, now?: number) {
    if (operation !== 'w' && operation !== 'n') {
        return;
    }

    if (!loadedWatchHistory) {
        setTimeout(() => {
            applyLocalVideoOperation(operation, videoId, now || Date.now());
        }, 500);

        return;
    }

    const videoOperation = `${operation}${videoId}`;
    if (localWatchHistory[videoOperation]) {
        return;
    }

    now = now || Date.now();

    localWatchHistory[videoOperation] = now;
    delete localWatchHistory[(operation === 'w' ? 'n' : 'w') + videoId];

    getPort().postMessage({
        type: 'saveVideoOperation',
        operation,
        videoId,
    });
}

export function watchVideo(videoId: string): void {
    applyLocalVideoOperation('w', videoId);
}
export function unwatchVideo(videoId: string): void {
    applyLocalVideoOperation('n', videoId);
}

export function log(content) {
    if (getSettings()['settings.log.enabled']) {
        console.log(prepareMessage(content));
    }
}


export function getCurrentPage() {
    return window.location.pathname?.replace(/\/$/, '') || '';
}

let activePort: TypedPort<IServiceWorkerToContentScriptPayload, IContentScriptToServiceWorkerPayload>;
export function getPort() {
    if (!activePort) {
        activePort = brwsr.runtime.connect({name: PREFIX});
    }

    return activePort;
}

