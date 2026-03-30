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
    if (_subscribedChannelIds !== null && _subscribedChannelIds.size > 0) return;

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
            if (ids.length > 0) {
                _subscribedChannelIds = new Set(ids);
                log("Subscription cache built: " + _subscribedChannelIds.size + " channels");
            } else {
                _subscribedChannelIds = null;
                logWarn("Subscription cache returned empty, will retry");
            }
        } catch (e) {
            _subscribedChannelIds = null;
            logWarn("Failed to parse subscription cache: " + e.message);
        }
    } else {
        _subscribedChannelIds = null;
        logWarn("Subscription cache data not available, will retry");
    }
}

function isSubscribedToChannel(channelId) {
    if (!channelId || !_subscribedChannelIds || _subscribedChannelIds.size === 0) return true;
    return _subscribedChannelIds.has(channelId);
}
