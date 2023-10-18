import brwsr from '../browser';
import {IContentScriptToServiceWorkerPayload, IServiceWorkerToContentScriptPayload, TypedPort} from '../port';
import {PREFIX} from '../util';

import {getSettings, loadSettings} from './settings';
import {getWatchedVideosHistory, loadWatchedVideos, saveVideoOperation} from './watchHistory';

const currentVersion = '0.19.1';

const LAST_SHOWN_CHANGELOG_KEY = 'changelog.lastShown';

loadSettings();
loadWatchedVideos();

brwsr.runtime.onConnect.addListener((port: TypedPort<IContentScriptToServiceWorkerPayload, IServiceWorkerToContentScriptPayload>) => {
    if (port.name !== PREFIX) {
        return;
    }

    port.onMessage.addListener((payload) => {
        if (payload.type === 'getSettings') {
            port.postMessage({
                type: 'settings',
                settings: getSettings(),
            });
        }
        else if (payload.type === 'getWatchHistory') {
            port.postMessage({
                type: 'watchHistory',
                watchHistory: getWatchedVideosHistory(),
            });
        }
        else if (payload.type === 'saveVideoOperation') {
            saveVideoOperation(payload.operation, payload.videoId);
        }
        else if (payload.type === 'openOptionsPage') {
            brwsr.runtime.openOptionsPage();
        }
    });
});

brwsr.runtime.onInstalled.addListener(async () => {
    const data = await brwsr.storage.local.get({LAST_SHOWN_CHANGELOG_KEY});

    if (currentVersion !== data.LAST_SHOWN_CHANGELOG_KEY) {
        brwsr.tabs.create({
            url: 'pages/changelog.html',
        });
        brwsr.storage.local.set({LAST_SHOWN_CHANGELOG_KEY: currentVersion});
    }
});
