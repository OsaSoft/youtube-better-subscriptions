const PREFIX = "osasoft-better-subscriptions_";

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

function setVideoInStorage(videoId) {
    let obj = {};
    obj[videoId] = Date.now();
    getStorage().set(obj);
}
