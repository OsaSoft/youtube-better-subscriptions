/**
 * Helper to load source files into the test environment
 * Handles the global function/variable declarations used in the browser extension
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Load a source file and execute it in a context that exposes functions globally
 * @param {string} filename - Name of the file in the project root or relative path
 * @param {object} additionalContext - Extra variables to provide to the script
 * @returns {object} - The context with all declared functions/variables
 */
function loadSource(filename, additionalContext = {}) {
    const projectRoot = path.join(__dirname, '../..');
    const filePath = path.join(projectRoot, filename);
    const code = fs.readFileSync(filePath, 'utf8');

    // Create context with node globals and our test globals
    const context = {
        ...global,
        console,
        document,
        window,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Date,
        Promise,
        JSON,
        Object,
        Array,
        Error,
        ReferenceError,
        ...additionalContext
    };

    vm.createContext(context);
    vm.runInContext(code, context, { filename: filePath });

    return context;
}

/**
 * Load util.js and expose its functions globally
 */
function loadUtil() {
    const context = loadSource('util.js', {
        settings: global.settings || {}
    });

    global.LOG_HEADER = context.LOG_HEADER;
    global.LOG_LEVEL = context.LOG_LEVEL;
    global.getLogLevel = context.getLogLevel;
    global.log = context.log;
    global.logDebug = context.logDebug;
    global.logWarn = context.logWarn;
    global.logError = context.logError;
    global.prepareMessage = context.prepareMessage;
    global.download = context.download;
    global.isRendered = context.isRendered;

    return context;
}

/**
 * Load common.js with dependencies
 */
function loadCommon() {
    // Ensure util is loaded first
    if (!global.log) {
        loadUtil();
    }

    const context = loadSource('common.js', {
        settings: global.settings,
        log: global.log,
        logDebug: global.logDebug,
        logWarn: global.logWarn,
        logError: global.logError,
        browser: global.browser,
        chrome: global.chrome
    });

    global.PREFIX = context.PREFIX;
    global.DEFAULT_SETTINGS = context.DEFAULT_SETTINGS;
    global.SETTINGS_KEY = context.SETTINGS_KEY;
    global.SETTINGS_LOCAL_KEY = context.SETTINGS_LOCAL_KEY;
    global.VIDEO_WATCH_KEY = context.VIDEO_WATCH_KEY;
    global.WATCHED_SYNC_THROTTLE = context.WATCHED_SYNC_THROTTLE;
    global.brwsr = context.brwsr;
    global.watchedVideos = context.watchedVideos;
    global.syncStorageGet = context.syncStorageGet;
    global.localStorageGet = context.localStorageGet;
    global.saveVideoOperation = context.saveVideoOperation;
    global.watchVideo = context.watchVideo;
    global.unwatchVideo = context.unwatchVideo;
    global.loadWatchedVideos = context.loadWatchedVideos;
    global.syncWatchedVideos = context.syncWatchedVideos;
    global.clearOldestVideos = context.clearOldestVideos;
    global.getCurrentPage = context.getCurrentPage;
    global.lastSyncUpdate = context.lastSyncUpdate;
    global.lastSyncError = context.lastSyncError;

    return context;
}

/**
 * Load queries.js
 */
function loadQueries() {
    const context = loadSource('queries.js', {
        HIDDEN_CLASS: global.HIDDEN_CLASS
    });

    global.vidQuery = context.vidQuery;
    global.sectionsQuery = context.sectionsQuery;
    global.sectionTitleQuery = context.sectionTitleQuery;
    global.sectionDismissableQuery = context.sectionDismissableQuery;
    global.sectionContentsQuery = context.sectionContentsQuery;

    return context;
}

/**
 * Load Video.js with dependencies
 */
function loadVideo() {
    if (!global.log) {
        loadUtil();
    }

    const context = loadSource('videos/Video.js', {
        settings: global.settings,
        log: global.log,
        logDebug: global.logDebug,
        logWarn: global.logWarn,
        logError: global.logError,
        watchedVideos: global.watchedVideos,
        METADATA_LINE: global.METADATA_LINE,
        MARK_WATCHED_BTN: global.MARK_WATCHED_BTN,
        MARK_UNWATCHED_BTN: global.MARK_UNWATCHED_BTN,
        HIDDEN_CLASS: global.HIDDEN_CLASS,
        hidden: global.hidden,
        hideWatched: global.hideWatched,
        hidePremieres: global.hidePremieres,
        hideShorts: global.hideShorts,
        hideLives: global.hideLives,
        hideMembersOnly: global.hideMembersOnly,
        watchVideo: global.watchVideo,
        unwatchVideo: global.unwatchVideo,
        syncWatchedVideos: global.syncWatchedVideos,
        processSections: global.processSections,
        buildMarkWatchedButton: global.buildMarkWatchedButton,
        changeMarkWatchedToMarkUnwatched: global.changeMarkWatchedToMarkUnwatched
    });

    global.getVideoIdFromUrl = context.getVideoIdFromUrl;
    global.getVideoUrl = context.getVideoUrl;
    global.getVideoId = context.getVideoId;
    global.getVideoDuration = context.getVideoDuration;
    global.isLivestream = context.isLivestream;
    global.isMembersOnly = context.isMembersOnly;
    global.changeMarkWatchedToMarkUnwatched = context.changeMarkWatchedToMarkUnwatched;
    global.Video = context.Video;

    return context;
}

/**
 * Load SubscriptionsVideo.js with dependencies
 */
function loadSubscriptionsVideo() {
    if (!global.Video) {
        loadVideo();
    }

    const context = loadSource('videos/SubscriptionsVideo.js', {
        Video: global.Video,
        buildMarkWatchedButton: global.buildMarkWatchedButton,
        getVideoId: global.getVideoId
    });

    global.SubscriptionVideo = context.SubscriptionVideo;

    return context;
}

/**
 * Load settingsLoader.js (without auto-calling loadSettings)
 */
function loadSettingsLoader(autoLoad = false) {
    if (!global.log) {
        loadUtil();
    }

    const projectRoot = path.join(__dirname, '../..');
    const filePath = path.join(projectRoot, 'settingsLoader.js');
    let code = fs.readFileSync(filePath, 'utf8');

    if (!autoLoad) {
        // Remove the auto-call to loadSettings at the end
        code = code.replace(/^loadSettings\(\);$/m, '// loadSettings(); - disabled for tests');
    }

    const context = {
        ...global,
        console,
        document,
        window,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Date,
        Promise,
        JSON,
        Object,
        Array,
        requestAnimationFrame: (cb) => setTimeout(cb, 0),
        settings: global.settings,
        DEFAULT_SETTINGS: global.DEFAULT_SETTINGS,
        SETTINGS_KEY: global.SETTINGS_KEY,
        SETTINGS_LOCAL_KEY: global.SETTINGS_LOCAL_KEY,
        PREFIX: global.PREFIX,
        brwsr: global.brwsr || global.browser,
        log: global.log,
        logDebug: global.logDebug,
        logWarn: global.logWarn,
        logError: global.logError,
        rebuildUI: global.rebuildUI
    };

    vm.createContext(context);
    vm.runInContext(code, context, { filename: filePath });

    global.settings = context.settings;
    global.settingsLoadedCallbacks = context.settingsLoadedCallbacks;
    global.settingsLoaded = context.settingsLoaded;
    global.migrateSettings = context.migrateSettings;
    global.settingsChanged = context.settingsChanged;
    global.showSettingsUpdatedNotification = context.showSettingsUpdatedNotification;
    global.loadSettings = context.loadSettings;

    return context;
}

module.exports = {
    loadSource,
    loadUtil,
    loadCommon,
    loadQueries,
    loadVideo,
    loadSubscriptionsVideo,
    loadSettingsLoader
};
