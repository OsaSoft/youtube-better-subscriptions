let brwsr;
try {
    brwsr = browser;
} catch (e) {
    if (e instanceof ReferenceError) {
        brwsr = chrome;
    }
}

brwsr.runtime.onMessage.addListener(function(message) {
    switch (message.action) {
        case "openOptionsPage":
            brwsr.runtime.openOptionsPage();
            break;
        default:
            break;
    }
});

brwsr.runtime.onInstalled.addListener(() => brwsr.tabs.create({
            url: "pages/changelog.html"
        })
);
