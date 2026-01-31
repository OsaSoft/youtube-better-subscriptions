let settings = {...DEFAULT_SETTINGS};
let settingsLoadedCallbacks = [];
let settingsLoaded = false;

// Helper to compare settings objects
function settingsChanged(oldSettings, newSettings) {
    if (!newSettings) return false;
    for (let key in DEFAULT_SETTINGS) {
        if (oldSettings[key] !== newSettings[key]) return true;
    }
    return false;
}

// Helper to show notification when settings updated from sync
function showSettingsUpdatedNotification() {
    // Create a subtle banner that auto-dismisses
    let banner = document.createElement("div");
    banner.className = PREFIX + "settings-updated-banner";
    banner.textContent = "Settings synced from cloud";
    banner.style.cssText = `
        position: fixed; top: 60px; right: 20px; z-index: 9999;
        background: #065fd4; color: white; padding: 8px 16px;
        border-radius: 4px; font-size: 13px; opacity: 0;
        transition: opacity 0.3s;
    `;
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.style.opacity = "1");
    setTimeout(() => {
        banner.style.opacity = "0";
        setTimeout(() => banner.remove(), 300);
    }, 3000);
}

// Main loading logic
async function loadSettings() {
    // Step 1: Try local storage first (fast)
    const localItems = await new Promise(resolve =>
        brwsr.storage.local.get(SETTINGS_LOCAL_KEY, resolve)
    );
    const localSettings = localItems[SETTINGS_LOCAL_KEY];

    if (localSettings) {
        // Have cached settings - start immediately
        log("Settings loaded from local cache");
        settings = {...DEFAULT_SETTINGS, ...localSettings};
        settingsLoaded = true;
        for (let callback of settingsLoadedCallbacks) {
            callback();
        }

        // Background: fetch sync and update if different
        brwsr.storage.sync.get(SETTINGS_KEY, items => {
            const syncSettings = items[SETTINGS_KEY];
            if (settingsChanged(settings, syncSettings)) {
                log("Sync settings differ, updating...");
                settings = {...DEFAULT_SETTINGS, ...syncSettings};
                brwsr.storage.local.set({[SETTINGS_LOCAL_KEY]: syncSettings});
                showSettingsUpdatedNotification();
                // Trigger UI rebuild if on subscriptions page
                if (typeof rebuildUI === 'function') rebuildUI();
            }
        });
    } else {
        // First install - wait briefly for sync
        log("No local cache, waiting for sync...");
        let syncTimeout = setTimeout(() => {
            if (!settingsLoaded) {
                log("Sync timeout, using defaults");
                settingsLoaded = true;
                for (let callback of settingsLoadedCallbacks) {
                    callback();
                }
            }
        }, 2000);

        brwsr.storage.sync.get(SETTINGS_KEY, items => {
            clearTimeout(syncTimeout);
            if (settingsLoaded) return; // Timeout already fired

            log("Settings loaded from sync");
            const syncSettings = items[SETTINGS_KEY];
            settings = {...DEFAULT_SETTINGS, ...syncSettings};

            // Cache to local for next time
            if (syncSettings) {
                brwsr.storage.local.set({[SETTINGS_LOCAL_KEY]: syncSettings});
            }

            settingsLoaded = true;
            for (let callback of settingsLoadedCallbacks) {
                callback();
            }
        });
    }
}

loadSettings();
