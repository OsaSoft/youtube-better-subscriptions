log("Initializing settings page...");

document.addEventListener("DOMContentLoaded", setupButtons);
document.addEventListener("DOMContentLoaded", initSettings);
document.addEventListener("DOMContentLoaded", displayVersion);

function initSettings() {
    if (settingsLoaded) {
        hideSpinners();
        showSettings();
        updateSettings();
    } else {
        settingsLoadedCallbacks.push(hideSpinners, showSettings, updateSettings);
    }
}

function updateSettings() {
    for (let key in settings) {
        let elem = document.getElementById(key);
        if (elem) {
            if (elem.matches('input[type="checkbox"]')) {
                elem.checked = settings[key];
            } else if (elem.matches('select')) {
                elem.value = settings[key];
            } else {
                elem.value = settings[key];
            }
        } else {
            logError({
                "message": "Updating setting #" + key + " returned " + elem,
                "stack": "settings.js:updateSettings",
            });
        }
    }
}

function showSettings() {
    for (let elem of document.querySelectorAll(".settings-list")) {
        elem.classList.remove("hidden");
    }
}

function hideSpinners() {
    for (let elem of document.querySelectorAll(".loading-spinner")) {
        elem.classList.add("hidden");
    }
}

function saveSettings() {
    let values = {};

    for (let elem of document.querySelectorAll("[id^='settings.']")) {
        if (elem.matches('input[type="checkbox"]')) {
            values[elem.id] = elem.checked;
        } else if (elem.matches('select')) {
            values[elem.id] = parseInt(elem.value, 10);
        } else {
            values[elem.id] = elem.value;
        }
    }

    log("Saving values:" + JSON.stringify(values));

    // Save to both sync (for cross-device) and local (for fast cache)
    brwsr.storage.sync.set({[SETTINGS_KEY]: values}, () => {
        if (brwsr.runtime.lastError) {
            logError("Warning: Failed to sync settings: " + brwsr.runtime.lastError.message);
            showToast("Failed to sync settings", "error");
        } else {
            showToast("Settings saved successfully", "success");
        }
    });
    brwsr.storage.local.set({[SETTINGS_LOCAL_KEY]: values});
}

function setupButtons() {
    document.getElementById("settings-save").addEventListener("click", saveSettings);
    document.getElementById("watched.export").addEventListener("click", exportVideos);
    document.getElementById("watched.import").addEventListener("click", importVideos);
    document.getElementById("watched.clear").addEventListener("click", showConfirmModal);

    // Modal event listeners
    document.getElementById("modal-cancel").addEventListener("click", hideConfirmModal);
    document.getElementById("modal-confirm").addEventListener("click", performClearVideos);
    document.getElementById("confirm-modal").querySelector(".modal__backdrop").addEventListener("click", hideConfirmModal);
}

async function exportVideos() {
    await loadWatchedVideos();

    const videoCount = Object.keys(watchedVideos).length;
    download("[Better Subs] video export " + new Date() + ".json", JSON.stringify(watchedVideos), "application/json");
    showToast(`Exported ${videoCount} videos`, "success");
}

async function importVideos() {
    const file = document.getElementById("watched.import.file").files[0];

    if (!file) {
        showToast("Please select a file first", "error");
        return;
    }

    const text = await file.text();

    try {
        let parsed = JSON.parse(text);
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
            showToast(`Imported ${parsedVideos} videos (${syncedVideos} synced)`, "success");
        }
        else {
            showToast(`Imported ${parsedVideos} videos successfully`, "success");
        }

        // Clear the file input
        document.getElementById("watched.import.file").value = "";
    } catch (e) {
        showToast("Error parsing import file", "error");
    }
}

function showConfirmModal() {
    document.getElementById("confirm-modal").classList.remove("hidden");
}

function hideConfirmModal() {
    document.getElementById("confirm-modal").classList.add("hidden");
}

async function performClearVideos() {
    hideConfirmModal();

    brwsr.storage.local.clear();

    await Promise.all(
        Object.keys((await syncStorageGet(null)) || {}).map(key => {
            if (key.indexOf(VIDEO_WATCH_KEY) === 0) {
                brwsr.storage.sync.remove(key);
            }
        })
    );

    await loadWatchedVideos();
    showToast("All watched videos cleared", "success");
}

function displayVersion() {
    const versionElement = document.getElementById("extension-version");
    if (versionElement && brwsr.runtime.getManifest) {
        const manifest = brwsr.runtime.getManifest();
        versionElement.textContent = manifest.version;
    }
}

// Toast notification system
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;

    // Add icon based on type
    const iconSvg = type === "success"
        ? '<svg class="toast__icon" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
        : '<svg class="toast__icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    container.appendChild(toast);

    // Auto-remove after delay
    setTimeout(() => {
        toast.classList.add("toast--hiding");
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
