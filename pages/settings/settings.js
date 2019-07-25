let settings = {...DEFAULT_SETTINGS};

log("Initializing settings page...");

getSyncStorage().get(SETTINGS_KEY, items => {
    log("Settings loaded..." + JSON.stringify(items[SETTINGS_KEY]));

    settings = {...settings, ...items[SETTINGS_KEY]};

    hideSpinners();
    showSettings();
    updateSettings();
});

document.addEventListener("DOMContentLoaded", () => document.getElementById("settings-save").addEventListener("click", saveSettings));

function updateSettings() {
    for (let key in settings) {
        let elem = document.getElementById(key);
        if (elem && elem.matches('input[type="checkbox"]')) {
            elem.checked = settings[key];
        } else {
            elem.value = settings[key];
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
    let values = {};

    for (let elem of document.querySelectorAll("input[id^='settings.']")) {
        if (elem.matches('input[type="checkbox"]')) {
            values[elem.id] = elem.checked;
        } else {
            values[elem.id] = elem.value
        }
    }

    log("Saving values:" + JSON.stringify(values));
    let storageVal = {};
    storageVal[SETTINGS_KEY] = values;
    getSyncStorage().set(storageVal);
}
