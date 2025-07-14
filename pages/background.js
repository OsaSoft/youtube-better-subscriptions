const currentVersion = "0.19.2";

const LAST_SHOWN_CHANGELOG_KEY = "changelog.lastShown";

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openOptionsPage") {
    chrome.runtime.openOptionsPage();
  }
});

// On install/update
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([LAST_SHOWN_CHANGELOG_KEY], (data) => {
    showChangelog(data);
  });
});

function showChangelog(data) {
  const lastShownChangelog = data[LAST_SHOWN_CHANGELOG_KEY];
  if (currentVersion !== lastShownChangelog) {
    chrome.tabs.create({
      url: "pages/changelog.html"
    });
    chrome.storage.local.set({ [LAST_SHOWN_CHANGELOG_KEY]: currentVersion });
  }
}
