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
    global.SYNC_FORMAT_VERSION = context.SYNC_FORMAT_VERSION;
    global.SYNC_META_KEY = context.SYNC_META_KEY;
    global.CLEAR_SENTINEL_KEY = context.CLEAR_SENTINEL_KEY;
    global.isVideoKey = context.isVideoKey;
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
    global.isSubscriptionsPage = context.isSubscriptionsPage;
    global.lastSyncUpdate = context.lastSyncUpdate;
    global.lastSyncError = context.lastSyncError;
    global.encodeTimestamp = context.encodeTimestamp;
    global.decodeTimestamp = context.decodeTimestamp;
    global.packSyncEntry = context.packSyncEntry;
    global.unpackSyncEntry = context.unpackSyncEntry;

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
        hideCollabsUnsubscribed: global.hideCollabsUnsubscribed,
        isSubscribedToChannel: global.isSubscribedToChannel || (() => true),
        getCurrentPage: global.getCurrentPage || (() => ''),
        isSubscriptionsPage: global.isSubscriptionsPage || (() => false),
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
    global.getPosterChannelId = context.getPosterChannelId;
    global.changeMarkWatchedToMarkUnwatched = context.changeMarkWatchedToMarkUnwatched;
    global.Video = context.Video;

    return context;
}

/**
 * Load SubscriptionsVideo.js with dependencies.
 * Loads both Video.js and SubscriptionsVideo.js in the same VM context
 * to avoid cross-context class inheritance issues.
 */
function loadSubscriptionsVideo() {
    if (!global.log) {
        loadUtil();
    }

    const projectRoot = path.join(__dirname, '../..');
    const videoCode = fs.readFileSync(path.join(projectRoot, 'videos/Video.js'), 'utf8');
    const subsVideoCode = fs.readFileSync(path.join(projectRoot, 'videos/SubscriptionsVideo.js'), 'utf8');

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
        Node,
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
        hideCollabsUnsubscribed: global.hideCollabsUnsubscribed,
        isSubscribedToChannel: global.isSubscribedToChannel || (() => true),
        getCurrentPage: global.getCurrentPage || (() => ''),
        isSubscriptionsPage: global.isSubscriptionsPage || (() => false),
        watchVideo: global.watchVideo,
        unwatchVideo: global.unwatchVideo,
        syncWatchedVideos: global.syncWatchedVideos,
        processSections: global.processSections,
        buildMarkWatchedButton: global.buildMarkWatchedButton,
        changeMarkWatchedToMarkUnwatched: global.changeMarkWatchedToMarkUnwatched,
        getVideoId: global.getVideoId
    };

    vm.createContext(context);
    vm.runInContext(videoCode, context, { filename: path.join(projectRoot, 'videos/Video.js') });
    vm.runInContext(subsVideoCode, context, { filename: path.join(projectRoot, 'videos/SubscriptionsVideo.js') });

    // Create factory function inside the VM context to avoid cross-realm prototype issues
    vm.runInContext(
        'function createSubscriptionVideo(elem) { return new SubscriptionVideo(elem); }',
        context
    );

    // Export Video.js globals
    global.getVideoIdFromUrl = context.getVideoIdFromUrl;
    global.getVideoUrl = context.getVideoUrl;
    global.getVideoId = context.getVideoId;
    global.getVideoDuration = context.getVideoDuration;
    global.isLivestream = context.isLivestream;
    global.isMembersOnly = context.isMembersOnly;
    global.getPosterChannelId = context.getPosterChannelId;
    global.changeMarkWatchedToMarkUnwatched = context.changeMarkWatchedToMarkUnwatched;
    global.Video = context.Video;
    global.SubscriptionVideo = context.SubscriptionVideo;
    global.createSubscriptionVideo = context.createSubscriptionVideo;

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

/**
 * Load subs-ui.js with dependencies
 */
function loadSubsUI() {
    if (!global.log) {
        loadUtil();
    }
    if (!global.vidQuery) {
        loadQueries();
    }
    if (!global.SubscriptionVideo) {
        loadSubscriptionsVideo();
    }

    const context = loadSource('subs-ui.js', {
        settings: global.settings,
        log: global.log,
        logDebug: global.logDebug,
        logWarn: global.logWarn,
        logError: global.logError,
        PREFIX: global.PREFIX,
        HIDDEN_CLASS: global.HIDDEN_CLASS,
        METADATA_LINE: global.METADATA_LINE,
        MARK_WATCHED_BTN: global.MARK_WATCHED_BTN,
        MARK_UNWATCHED_BTN: global.MARK_UNWATCHED_BTN,
        HIDE_WATCHED_TOGGLE: global.HIDE_WATCHED_TOGGLE,
        HIDE_WATCHED_LABEL: global.HIDE_WATCHED_LABEL,
        MARK_ALL_WATCHED_BTN: global.MARK_ALL_WATCHED_BTN,
        SETTINGS_BTN: global.SETTINGS_BTN,
        brwsr: global.brwsr || global.browser,
        hidden: global.hidden,
        hideWatched: global.hideWatched,
        SubscriptionVideo: global.SubscriptionVideo,
        sectionsQuery: global.sectionsQuery,
        sectionTitleQuery: global.sectionTitleQuery,
        sectionDismissableQuery: global.sectionDismissableQuery,
        sectionContentsQuery: global.sectionContentsQuery,
        vidQuery: global.vidQuery,
        markAllAsWatched: global.markAllAsWatched,
        hideWatchedChanged: global.hideWatchedChanged,
        collapseSectionChanged: global.collapseSectionChanged,
        loadMoreVideos: global.loadMoreVideos,
        getCurrentPage: global.getCurrentPage,
        isSubscriptionsPage: global.isSubscriptionsPage,
        isRendered: global.isRendered,
        hideMostRelevant: global.hideMostRelevant
    });

    global.COLLAPSE_CLASS = context.COLLAPSE_CLASS;
    global.buildMarkWatchedButton = context.buildMarkWatchedButton;
    global.processSections = context.processSections;
    global.removeWatchedAndAddButton = context.removeWatchedAndAddButton;
    global.buildUI = context.buildUI;
    global.removeUI = context.removeUI;
    global.rebuildUI = context.rebuildUI;
    global.showWatched = context.showWatched;

    return context;
}

/**
 * Load subs.js with dependencies
 */
function loadSubs() {
    if (!global.log) {
        loadUtil();
    }
    if (!global.vidQuery) {
        loadQueries();
    }
    if (!global.SubscriptionVideo) {
        loadSubscriptionsVideo();
    }
    if (!global.buildUI) {
        loadSubsUI();
    }

    const context = loadSource('subs.js', {
        settings: global.settings,
        log: global.log,
        logDebug: global.logDebug,
        logWarn: global.logWarn,
        logError: global.logError,
        vidQuery: global.vidQuery,
        SubscriptionVideo: global.SubscriptionVideo,
        loadWatchedVideos: global.loadWatchedVideos,
        buildUI: global.buildUI,
        removeUI: global.removeUI,
        removeWatchedAndAddButton: global.removeWatchedAndAddButton,
        processSections: global.processSections,
        loadMoreVideos: global.loadMoreVideos,
        isRendered: global.isRendered,
        getCurrentPage: global.getCurrentPage,
        HIDDEN_CLASS: global.HIDDEN_CLASS,
        sectionDismissableQuery: global.sectionDismissableQuery,
        sectionContentsQuery: global.sectionContentsQuery
    });

    global.isYouTubeWatched = context.isYouTubeWatched;
    global.getVideoTitle = context.getVideoTitle;
    global.initSubs = context.initSubs;
    global.stopSubs = context.stopSubs;
    global.hidden = context.hidden;
    global.hideWatched = context.hideWatched;
    global.hidePremieres = context.hidePremieres;
    global.hideShorts = context.hideShorts;
    global.hideLives = context.hideLives;
    global.hideMembersOnly = context.hideMembersOnly;

    return context;
}

module.exports = {
    loadSource,
    loadUtil,
    loadCommon,
    loadQueries,
    loadVideo,
    loadSubscriptionsVideo,
    loadSettingsLoader,
    loadSubsUI,
    loadSubs
};
