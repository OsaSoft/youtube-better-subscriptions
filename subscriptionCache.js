let _subscribedChannelIds = null;
let _pageContextInjected = false;

// Inject pageContext.js into the page's main world to access Polymer data.
// CSP blocks inline scripts, so we use an external file via web_accessible_resources.
function _injectPageContextScript() {
    if (_pageContextInjected) return;
    _pageContextInjected = true;

    const script = document.createElement('script');
    script.src = brwsr.runtime.getURL('pageContext.js');
    document.documentElement.appendChild(script);
    script.onload = () => script.remove();
}

async function buildSubscriptionCache() {
    if (_subscribedChannelIds !== null) return;
    _subscribedChannelIds = new Set();

    _injectPageContextScript();

    // Poll for result from pageContext.js (stored in DOM data attribute)
    let cacheData = null;
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 500));
        cacheData = document.documentElement.dataset.ytBetterSubsCache;
        if (cacheData) break;
    }

    if (cacheData) {
        try {
            const ids = JSON.parse(cacheData);
            for (const id of ids) {
                _subscribedChannelIds.add(id);
            }
            log("Subscription cache built: " + _subscribedChannelIds.size + " channels");
        } catch (e) {
            logWarn("Failed to parse subscription cache: " + e.message);
        }
    } else {
        logWarn("Subscription cache data not available");
    }
}

function isSubscribedToChannel(channelId) {
    if (!channelId || !_subscribedChannelIds || _subscribedChannelIds.size === 0) return true;
    return _subscribedChannelIds.has(channelId);
}
