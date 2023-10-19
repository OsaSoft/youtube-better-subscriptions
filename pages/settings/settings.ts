import brwsr from '../../browser';
import {getPort, log, setLocalWatchHistory} from '../../contentScript/common';
import {getSettings, setLocalSettings} from '../../contentScript/settings';
import {logError} from '../../util';

log('Initializing settings page...');

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('settings-save')?.addEventListener('click', saveSettings);
    document.getElementById('watched.export')?.addEventListener('click', exportVideos);
    document.getElementById('watched.import')?.addEventListener('click', importVideos);
    document.getElementById('watched.clear')?.addEventListener('click', clearVideos);

    getPort().onMessage.addListener((message) => {
        if (message.type === 'settings') {
            setLocalSettings(message.settings);

            hideSpinners();
            showSettings();
            updateSettings();
        }
        else if (message.type === 'watchHistory') {
            setLocalWatchHistory(message.watchHistory);
        }
    });

    getPort().postMessage({type: 'getSettings'});
    getPort().postMessage({type: 'getWatchHistory'});
});


function updateSettings() {
    const settings = getSettings();

    for (const key in settings) {
        const elem = document.getElementById(key);
        if (elem) {
            if (elem.matches('input[type="checkbox"]')) {
                elem.checked = settings[key];
            }
            else {
                elem.value = settings[key];
            }
        }
        else {
            logError({
                'message': `Updating setting #${key} returned ${elem}`,
                'stack': 'settings.js:updateSettings',
            });
        }
    }
}

function showSettings() {
    for (const elem of document.querySelectorAll('[id^=\'settings-\']')) {
        elem.classList.remove('hidden');
    }
}

function hideSpinners() {
    for (const elem of document.getElementsByClassName('sk-circle')) {
        elem.classList.add('hidden');
    }
}

function saveSettings() {
    const values = {};

    for (const elem of document.querySelectorAll('input[id^=\'settings.\']')) {
        if (elem.matches('input[type="checkbox"]')) {
            values[elem.id] = elem.checked;
        }
        else {
            values[elem.id] = elem.value;
        }
    }

    log('Saving values:' + JSON.stringify(values));
    brwsr.storage.sync.set({
        [SETTINGS_KEY]: values,
    });
}

async function exportVideos() {
    await loadWatchedVideos();

    download('[Better Subs] video export ' + new Date() + '.json', JSON.stringify(watchedVideos), 'application/json');
}

async function importVideos() {
    const file = document.getElementById('watched.import.file').files[0];

    if (!file) {
        window.alert('No file selected!');
        return;
    }

    const text = await file.text();

    try {
        const parsed = JSON.parse(text);
        let parsedVideos = 0;

        for (const videoIdOrOperation of Object.keys(parsed)) {
            if (typeof parsed[videoIdOrOperation] !== 'number') {
                continue;
            }
            parsedVideos++;

            if (videoIdOrOperation.length === 11) {
                // old format
                watchVideo(videoIdOrOperation, parsed[videoIdOrOperation]);
            }
            else if (videoIdOrOperation.length === 12) {
                // new format
                saveVideoOperation(videoIdOrOperation, parsed[videoIdOrOperation]);
            }
        }
        const syncedVideos = await syncWatchedVideos();

        if (syncedVideos < parsedVideos) {
            window.alert(`Imported ${parsedVideos} watched videos successfully. Only the most recent ${syncedVideos} watched videos have been synced.`);
        }
        else {
            window.alert(`Imported ${parsedVideos} watched videos successfully. All watched videos have been synced.`);
        }
    }
    catch {
        window.alert('Error parsing import file!');
    }
}

async function clearVideos() {
    if (window.confirm('This is a destructive operation and will remove all of your marked as watched videos! \nAre you sure?')) {
        brwsr.storage.local.clear();

        await Promise.all(
            Object.keys((await syncStorageGet(null)) || {}).map(key => {
                if (key.indexOf(VIDEO_WATCH_KEY) === 0) {
                    brwsr.storage.sync.remove(key);
                }
            }),
        );

        await loadWatchedVideos();
    }
}
