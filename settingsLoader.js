let settings = {...DEFAULT_SETTINGS};
let settingsLoadedCallbacks = [];
let settingsLoaded = false;

// Migrate old boolean log settings to new level system
function migrateSettings(loadedSettings) {
    if (!loadedSettings) return loadedSettings;

    // Migrate old boolean log settings to new level system
    if (typeof loadedSettings["settings.log.enabled"] === "boolean") {
        if (loadedSettings["settings.log.debug"]) {
            loadedSettings["settings.log.level"] = 4; // DEBUG
        } else if (loadedSettings["settings.log.enabled"]) {
            loadedSettings["settings.log.level"] = 3; // INFO
        } else {
            loadedSettings["settings.log.level"] = 1; // ERROR (minimum)
        }
        delete loadedSettings["settings.log.enabled"];
        delete loadedSettings["settings.log.debug"];
    }

    return loadedSettings;
}

// Helper to compare settings objects
function settingsChanged(oldSettings, newSettings) {
    if (!newSettings) return false;
    for (let key in DEFAULT_SETTINGS) {
        if (oldSettings[key] !== newSettings[key]) return true;
    }
    // Detect new keys from newer extension versions
    for (let key in newSettings) {
        if (!(key in oldSettings)) return true;
    }
    return false;
}

// Helper to show notification when settings updated from sync
function showSettingsUpdatedNotification() {
    // Create a subtle banner that auto-dismisses
    let banner = document.createElement("div");
    banner.className = PREFIX + "settings-updated-banner";
    banner.textContent = "Better Subscriptions: Settings synced and applied.";
    banner.style.cssText = `
        position: fixed; top: 60px; right: 20px; z-index: 9999;
        background: #065fd4; color: white; padding: 8px 16px;
        border-radius: 4px; font-size: 13px; opacity: 0;
        transition: opacity 0.3s;
    `;
    const target = document.body || document.documentElement;
    if (!target) return;
    target.appendChild(banner);
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
        const migratedLocal = migrateSettings({...localSettings});
        settings = {...DEFAULT_SETTINGS, ...migratedLocal};
        // If migrated, update local cache
        if (migratedLocal["settings.log.level"] !== undefined && localSettings["settings.log.enabled"] !== undefined) {
            brwsr.storage.local.set({[SETTINGS_LOCAL_KEY]: migratedLocal});
        }
        settingsLoaded = true;
        for (let callback of settingsLoadedCallbacks) {
            callback();
        }

        // Background: fetch sync and update if different
        brwsr.storage.sync.get(SETTINGS_KEY, items => {
            if (brwsr.runtime.lastError) {
                log("Sync storage error: " + brwsr.runtime.lastError.message);
                return;
            }
            const syncSettings = items[SETTINGS_KEY];
            if (settingsChanged(settings, syncSettings)) {
                log("Sync settings differ, updating...");
                const migratedSync = migrateSettings({...syncSettings});
                settings = {...DEFAULT_SETTINGS, ...migratedSync};
                brwsr.storage.local.set({[SETTINGS_LOCAL_KEY]: migratedSync});
                // If migrated, update sync storage too
                if (migratedSync["settings.log.level"] !== undefined && syncSettings["settings.log.enabled"] !== undefined) {
                    brwsr.storage.sync.set({[SETTINGS_KEY]: migratedSync});
                }
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
            const migratedSync = migrateSettings(syncSettings ? {...syncSettings} : null);
            settings = {...DEFAULT_SETTINGS, ...migratedSync};

            // Cache to local for next time
            if (migratedSync) {
                brwsr.storage.local.set({[SETTINGS_LOCAL_KEY]: migratedSync});
                // If migrated, update sync storage too
                if (migratedSync["settings.log.level"] !== undefined && syncSettings["settings.log.enabled"] !== undefined) {
                    brwsr.storage.sync.set({[SETTINGS_KEY]: migratedSync});
                }
            }

            settingsLoaded = true;
            for (let callback of settingsLoadedCallbacks) {
                callback();
            }
        });
    }
}

loadSettings();
