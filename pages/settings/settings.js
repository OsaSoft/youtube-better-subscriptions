log("Initializing settings page...");

document.addEventListener("DOMContentLoaded", setupButtons);
document.addEventListener("DOMContentLoaded", initSettings);

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
    for (let elem of document.querySelectorAll("[id^='settings-']")) {
        elem.classList.remove("hidden");
    }
}

function hideSpinners() {
    for (let elem of document.getElementsByClassName("sk-circle")) {
        elem.classList.add("hidden");
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

function setupButtons() {
    document.getElementById("settings-save").addEventListener("click", saveSettings);
    document.getElementById("watched.export").addEventListener("click", exportVideos);
    document.getElementById("watched.import").addEventListener("click", importVideos);
    document.getElementById("watched.clear").addEventListener("click", clearVideos);
}

function exportVideos() {
    let videos = {};
    getStorage().get(null, items => { //fill our map with watched videos
        videos = items;

        download("[Better Subs] video export " + new Date() + ".json", JSON.stringify(videos), "application/json");
    });
}

function importVideos() {
    const file = document.getElementById("watched.import.file").files[0];

    if (!file) {
        window.alert("No file selected!");
        return;
    }

    file.text().then(text => {
        try {
            let parsed = JSON.parse(text);
            getStorage().set(parsed);
            window.alert("Imported " + Object.keys(parsed).length + " watched videos successfully");
        } catch (e) {
            window.alert("Error parsing import file!");
        }
    });
}

function clearVideos() {
    if (window.confirm("This is a destructive operation and will remove all of your marked as watched videos! \nAre you sure?")) {
        getStorage().clear();
    }
}
