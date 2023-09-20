const currentVersion = "0.18.0";

const LAST_SHOWN_CHANGELOG_KEY = "changelog.lastShown";

let brwsr;
try {
    brwsr = browser;
} catch (e) {
    if (e instanceof ReferenceError) {
        brwsr = chrome;
    }
}

brwsr.runtime.onMessage.addListener(function (message) {
    switch (message.action) {
        case "openOptionsPage":
            brwsr.runtime.openOptionsPage();
            break;
        default:
            break;
    }
});

brwsr.runtime.onInstalled.addListener(() => {
    brwsr.storage.local.get({LAST_SHOWN_CHANGELOG_KEY}, showChangelog);
});

function showChangelog(data) {
    let lastShownChangelog = data.LAST_SHOWN_CHANGELOG_KEY;
    if (currentVersion !== lastShownChangelog) {
        brwsr.tabs.create({
            url: "pages/changelog.html"
        });
        brwsr.storage.local.set({LAST_SHOWN_CHANGELOG_KEY: currentVersion});
    }
}
