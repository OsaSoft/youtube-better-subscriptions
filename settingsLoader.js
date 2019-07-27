let settings = {...DEFAULT_SETTINGS};

let settingsLoadedCallbacks = [];

getSyncStorage().get(SETTINGS_KEY, items => {
    log("Settings loaded");

    settings = {...settings, ...items[SETTINGS_KEY]};

    for (let callback of settingsLoadedCallbacks) {
        callback();
    }
});
