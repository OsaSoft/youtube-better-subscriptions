const currentVersion = "0.24.0";

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

brwsr.runtime.onInstalled.addListener((details) => {
    brwsr.storage.local.get({LAST_SHOWN_CHANGELOG_KEY}, (data) => {
        showChangelog(data, details);
    });
});

function showChangelog(data, details) {
    let lastShownChangelog = data.LAST_SHOWN_CHANGELOG_KEY;
    if (currentVersion === lastShownChangelog) {
        return;
    }

    // Always update the last shown version, even if we don't open the tab
    brwsr.storage.local.set({LAST_SHOWN_CHANGELOG_KEY: currentVersion});

    // Always show changelog on first install
    if (details && details.reason === "install") {
        brwsr.tabs.create({ url: "pages/changelog.html" });
        return;
    }

    // On update, check the user's setting
    brwsr.storage.sync.get("settings", (result) => {
        let autoOpen = true; // default: open changelog
        if (result && result.settings && typeof result.settings["settings.changelog.auto.open"] === "boolean") {
            autoOpen = result.settings["settings.changelog.auto.open"];
        }
        if (autoOpen) {
            brwsr.tabs.create({ url: "pages/changelog.html" });
        }
    });
}
