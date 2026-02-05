log("Initializing settings page...");

document.addEventListener("DOMContentLoaded", setupButtons);
document.addEventListener("DOMContentLoaded", initSettings);
document.addEventListener("DOMContentLoaded", displayVersion);
document.addEventListener("DOMContentLoaded", runSyncDiagnostics);

// Track the element that opened the modal for focus restoration
let previouslyFocusedElement = null;

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
    document.getElementById("test-sync").addEventListener("click", testSyncConnectivity);
    document.getElementById("force-sync").addEventListener("click", forceSyncAll);

    // Modal event listeners
    document.getElementById("modal-cancel").addEventListener("click", hideConfirmModal);
    document.getElementById("modal-confirm").addEventListener("click", performClearVideos);
    document.getElementById("confirm-modal").querySelector(".modal__backdrop").addEventListener("click", hideConfirmModal);

    // Escape key to close modal
    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape") {
            const modal = document.getElementById("confirm-modal");
            if (!modal.classList.contains("hidden")) {
                hideConfirmModal();
            }
        }
    });
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
    previouslyFocusedElement = document.activeElement;
    const modal = document.getElementById("confirm-modal");
    modal.classList.remove("hidden");
    // Focus the cancel button when modal opens
    document.getElementById("modal-cancel").focus();
}

function hideConfirmModal() {
    document.getElementById("confirm-modal").classList.add("hidden");
    // Restore focus to the element that opened the modal
    if (previouslyFocusedElement) {
        previouslyFocusedElement.focus();
        previouslyFocusedElement = null;
    }
}

// Helper to promisify storage operations for Chrome compatibility
function storageLocalRemove(keys) {
    return new Promise((resolve) => {
        brwsr.storage.local.remove(keys, resolve);
    });
}

function storageSyncRemove(key) {
    return new Promise((resolve) => {
        brwsr.storage.sync.remove(key, resolve);
    });
}

async function performClearVideos() {
    hideConfirmModal();

    // Clear only watched-video-related data from local storage, preserving settings
    const localData = await new Promise((resolve) => {
        brwsr.storage.local.get(null, resolve);
    });
    const localKeys = Object.keys(localData || {});
    const localWatchedKeys = localKeys.filter(key => {
        // Keys for watched videos use VIDEO_WATCH_KEY prefix
        // Preserve settings keys (SETTINGS_LOCAL_KEY, etc.)
        if (typeof VIDEO_WATCH_KEY === "string" && VIDEO_WATCH_KEY.length > 0) {
            return key.indexOf(VIDEO_WATCH_KEY) === 0;
        }
        return false;
    });
    if (localWatchedKeys.length > 0) {
        await storageLocalRemove(localWatchedKeys);
    }

    // Clear watched videos from sync storage
    const syncData = await syncStorageGet(null);
    const syncKeys = Object.keys(syncData || {});
    const removePromises = syncKeys
        .filter(key => key.indexOf(VIDEO_WATCH_KEY) === 0)
        .map(key => storageSyncRemove(key));
    await Promise.all(removePromises);

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

    // Create icon SVG using DOM methods to avoid innerHTML injection
    const iconSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    iconSvg.setAttribute("class", "toast__icon");
    iconSvg.setAttribute("viewBox", "0 0 24 24");
    iconSvg.setAttribute("fill", "currentColor");

    const iconPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    if (type === "success") {
        iconPath.setAttribute("d", "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z");
    } else {
        iconPath.setAttribute("d", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z");
    }
    iconSvg.appendChild(iconPath);

    const messageSpan = document.createElement("span");
    messageSpan.textContent = message;

    toast.appendChild(iconSvg);
    toast.appendChild(messageSpan);
    container.appendChild(toast);

    // Auto-remove after delay
    setTimeout(() => {
        toast.classList.add("toast--hiding");
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Sync Diagnostics Functions
async function runSyncDiagnostics() {
    try {
        // Get sync storage data
        const syncData = await syncStorageGet(null);
        const syncBytes = JSON.stringify(syncData).length;

        // Count videos in sync (vw_* batched format)
        let syncVideoCount = 0;
        for (const key of Object.keys(syncData)) {
            if (key.indexOf(VIDEO_WATCH_KEY) === 0 && Array.isArray(syncData[key])) {
                syncVideoCount += syncData[key].length;
            }
        }

        // Get local storage data
        const localData = await localStorageGet(null);
        // Count videos in local (w* or n* format, 12 chars)
        const localVideoCount = Object.keys(localData || {})
            .filter(key => key.length === 12 && (key[0] === 'w' || key[0] === 'n'))
            .length;

        // Update UI
        document.getElementById("sync-storage-usage").textContent =
            (syncBytes / 1024).toFixed(1) + " KB / 100 KB";
        document.getElementById("sync-video-count").textContent = syncVideoCount;
        document.getElementById("local-video-count").textContent = localVideoCount;
    } catch (error) {
        document.getElementById("sync-storage-usage").textContent = "Error";
        document.getElementById("sync-video-count").textContent = "Error";
        document.getElementById("local-video-count").textContent = "Error";
        logError({message: "Failed to run sync diagnostics", stack: error?.stack || ""});
    }
}

async function testSyncConnectivity() {
    const resultEl = document.getElementById("sync-result");
    const testKey = "_sync_test_" + Date.now();
    const testValue = "test_" + Math.random();

    resultEl.textContent = "Testing sync connectivity...";
    resultEl.className = "sync-result sync-result--info";

    try {
        // Write to sync
        await new Promise((resolve, reject) => {
            brwsr.storage.sync.set({ [testKey]: testValue }, () => {
                if (brwsr.runtime.lastError) {
                    reject(new Error(brwsr.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });

        // Read back
        const result = await syncStorageGet(testKey);

        // Cleanup
        await new Promise(resolve => brwsr.storage.sync.remove(testKey, resolve));

        if (result[testKey] === testValue) {
            resultEl.textContent = "Sync storage is working correctly";
            resultEl.className = "sync-result sync-result--success";
        } else {
            resultEl.textContent = "Sync read/write mismatch - data may not be syncing properly";
            resultEl.className = "sync-result sync-result--error";
        }
    } catch (error) {
        resultEl.textContent = "Sync failed: " + error.message;
        resultEl.className = "sync-result sync-result--error";
    }
}

async function forceSyncAll() {
    const resultEl = document.getElementById("sync-result");

    resultEl.textContent = "Syncing all watched videos...";
    resultEl.className = "sync-result sync-result--info";

    try {
        await loadWatchedVideos();
        const syncedCount = await syncWatchedVideos();

        resultEl.textContent = "Synced " + syncedCount + " videos to cloud storage";
        resultEl.className = "sync-result sync-result--success";

        // Refresh diagnostics display
        await runSyncDiagnostics();
    } catch (error) {
        resultEl.textContent = "Force sync failed: " + error.message;
        resultEl.className = "sync-result sync-result--error";
    }
}
