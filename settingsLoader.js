let settings = {...DEFAULT_SETTINGS};

let settingsLoadedCallbacks = [];

let settingsLoaded = false;

getSyncStorage().get(SETTINGS_KEY, items => {
    log("Settings loaded:");
    log(items[SETTINGS_KEY]);
    settingsLoaded = true;

    settings = {...settings, ...items[SETTINGS_KEY]};

    for (let callback of settingsLoadedCallbacks) {
        callback();
    }
});
