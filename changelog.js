let brwsr;
try {
    brwsr = browser;
} catch (e) {
    if (e instanceof ReferenceError) {
        brwsr = chrome;
    }
}

brwsr.runtime.onInstalled.addListener(() => brwsr.tabs.create({
            url: "changelog.html"
        })
);
