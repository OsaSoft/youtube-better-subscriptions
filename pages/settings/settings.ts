import brwsr from '../../browser';
import {log} from '../../contentScript/common';
import {SETTINGS_KEY, getSettings, loadSettings} from '../../serviceWorker/settings';
import {
    deleteWatchHistory,
    getWatchedVideosHistory,
    loadWatchedVideos,
    saveVideoOperation,
    syncWatchedVideos,
} from '../../serviceWorker/watchHistory';
import {download, logError} from '../../util';

import './settings.scss';

log('Initializing settings page...');

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('settings-save')?.addEventListener('click', saveSettings);
    document.getElementById('watched.export')?.addEventListener('click', exportVideos);
    document.getElementById('watched.import')?.addEventListener('click', importVideos);
    document.getElementById('watched.clear')?.addEventListener('click', clearVideos);

    await Promise.all([
        loadSettings(),
        loadWatchedVideos(),
    ]);

    hideSpinners();
    showSettings();
    updateSettings();
});


function updateSettings() {
    const settings = getSettings();

    for (const key in settings) {
        const elem = document.getElementById(key) as HTMLInputElement;
        if (elem) {
            if (elem.matches('input[type="checkbox"]')) {
                elem.checked = settings[key];
            }
            else {
                elem.value = settings[key];
            }
        }
        else {
            logError(new Error(`Updating setting #${key} returned ${elem}`));
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

    const settingsElems = document.querySelectorAll('input[id^=\'settings.\']') as NodeListOf<HTMLInputElement>;
    for (const elem of settingsElems) {
        if (elem.matches('input[type="checkbox"]')) {
            values[elem.id] = elem.checked;
        }
        else {
            values[elem.id] = elem.value;
        }
    }

    log(`Saving values: ${JSON.stringify(values)}`);
    brwsr.storage.sync.set({
        [SETTINGS_KEY]: values,
    });
}

async function exportVideos() {
    // get latest watch history
    await loadWatchedVideos();

    const watchHistory = await getWatchedVideosHistory();

    download(`[Better Subs] video export ${new Date()}.json`, JSON.stringify(watchHistory), 'application/json');
}

async function importVideos() {
    const file = (document.getElementById('watched.import.file') as HTMLInputElement).files[0];

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
                saveVideoOperation('w', videoIdOrOperation, parsed[videoIdOrOperation]);
            }
            else if (videoIdOrOperation.length === 12) {
                // new format
                saveVideoOperation(videoIdOrOperation[0] as 'w' | 'n', videoIdOrOperation.slice(1), parsed[videoIdOrOperation]);
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
    if (window.confirm('This is a DESTRUCTIVE and IMMEDIATE operation that will remove all of your marked as watched videos! \nAre you sure?')) {
        await deleteWatchHistory();
    }
}
