let settings = {...DEFAULT_SETTINGS};

getSyncStorage().get(SETTINGS_KEY, items => {
    settings = {...settings, ...items.settings};

    hideSpinners();
    showSettings();
    updateSettings();
});

brwsr.storage.onChanged.addListener(storageChanged);
