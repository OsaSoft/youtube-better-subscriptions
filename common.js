let brwsr;
try {
    brwsr = browser;
} catch (e) {
    if (e instanceof ReferenceError) {
        brwsr = chrome;
    }
}

function getStorage() {
    return brwsr.storage.local //TODO: use sync?
}