const PREFIX = "osasoft-better-subscriptions_";

const DEFAULT_SETTINGS = {
    "settings.hide.watched.label": true,
    "settings.hide.watched.all.label": true,
    "settings.hide.watched.ui.stick.right": false,
    "settings.hide.watched.default": true,
    "settings.hide.watched.keep.state": true,
    "settings.hide.watched.refresh.rate": 3000,
    "settings.mark.watched.youtube.watched": false,
    "settings.log.enabled": false,
    "settings.hide.watched.support.channel": true,
    "settings.hide.watched.support.home": true,
    "settings.hide.watched.auto.store": true,
    "settings.hide.premieres": false,
    "settings.hide.shorts": false,
};

const SETTINGS_KEY = "settings";

let brwsr;
try {
    brwsr = browser;
} catch (e) {
    if (e instanceof ReferenceError) {
        brwsr = chrome;
    }
}

function getStorage() {
    return brwsr.storage.local; //TODO: use sync?
}

function loadStorage() {
    return new Promise(function (resolve, reject) {
        getStorage().get(null, function (items) {
            resolve(items);
        });
    })
}

function getSyncStorage() {
    return brwsr.storage.sync;
}

function setVideoInStorage(videoId) {
    let obj = {};
    obj[videoId] = Date.now();
    getStorage().set(obj);
}

function getCurrentPage() {
    let path = window.location.pathname;
    if (path != null) {
        return path.replace(/\/$/, "");
    }

    return "";
}
