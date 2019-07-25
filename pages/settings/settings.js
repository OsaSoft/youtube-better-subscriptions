const DEFAULT_SETTINGS = {
    "settings.hide.watched.label": true,
    "settings.hide.watched.default": true
};

let settings = {...DEFAULT_SETTINGS};

getSyncStorage().get("settings", items => {
    settings = {...items.settings};

    hideSpinners();
    showSettings();
    updateSettings();
});

brwsr.storage.onChanged.addListener(storageChanged);

function updateSettings() {
    for (let key in settings) {
        let elem = document.getElementById(key);
        if (elem && elem.matches('input[type="checkbox"]')) {
            elem.checked = settings[key];
        }
    }
}

function showSettings() {
    for (let elem of document.querySelectorAll("[id^='settings-']")) {
        show(elem);
    }
}

function hideSpinners() {
    for (let elem of document.getElementsByClassName("sk-circle")) {
        hide(elem);
    }
}

function saveSettings() {
    document.querySelectorAll("input")
}

function storageChanged(changes, area) {
    if (area === "sync") {
        for (let key in changes) {
            let newValue = changes[key].newValue;
            if (newValue != null) { // is new added
                settings[key] = newValue;
            } else { // is removed
                delete settings[key];
            }
        }

        updateSettings();
    }
}
