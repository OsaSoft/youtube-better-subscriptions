/**
 * Jest Test Setup
 * Global mocks and helpers for YouTube Better Subscriptions tests
 */

const { createStorageMock } = require('./mocks/browser-api');

// Default settings matching common.js
const DEFAULT_SETTINGS = {
    "settings.hide.watched.label": true,
    "settings.hide.watched.all.label": true,
    "settings.hide.watched.ui.stick.right": true,
    "settings.hide.watched.default": true,
    "settings.hide.watched.keep.state": true,
    "settings.hide.watched.refresh.rate": 3000,
    "settings.mark.watched.youtube.watched": false,
    "settings.log.level": 1,
    "settings.hide.watched.support.channel": true,
    "settings.hide.watched.support.home": true,
    "settings.hide.watched.auto.store": true,
    "settings.hide.premieres": false,
    "settings.hide.shorts": false,
    "settings.hide.lives": false,
    "settings.hide.members.only": false,
};

// Constants matching the codebase
const PREFIX = "osasoft-better-subscriptions_";
const VIDEO_WATCH_KEY = "vw_";
const SETTINGS_KEY = "settings";
const SETTINGS_LOCAL_KEY = "settings_cache";
const WATCHED_SYNC_THROTTLE = 1000;

// UI Constants
const HIDE_WATCHED_TOGGLE = PREFIX + "hide-watched-toggle";
const HIDE_WATCHED_LABEL = PREFIX + "hide-watched-toggle-label";
const MARK_ALL_WATCHED_BTN = PREFIX + "subs-grid-menu-mark-all";
const SETTINGS_BTN = PREFIX + "subs-grid-menu-settings";
const MARK_WATCHED_BTN = PREFIX + "mark-watched";
const MARK_UNWATCHED_BTN = PREFIX + "mark-unwatched";
const METADATA_LINE = PREFIX + "metadata-line";
const HIDDEN_CLASS = PREFIX + "hidden";

// Log level constants
const LOG_LEVEL = { ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4 };

beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    jest.useRealTimers();

    // Create fresh browser mock
    const browserMock = createStorageMock();
    global.browser = browserMock;
    global.chrome = browserMock;
    global.brwsr = browserMock;

    // Reset global state
    global.settings = { ...DEFAULT_SETTINGS };
    global.watchedVideos = {};
    global.settingsLoaded = false;
    global.settingsLoadedCallbacks = [];
    global.hidden = [];
    global.addedElems = [];

    // Reset hide flags
    global.hideWatched = false;
    global.hidePremieres = false;
    global.hideShorts = false;
    global.hideLives = false;
    global.hideMembersOnly = false;

    // Expose constants
    global.PREFIX = PREFIX;
    global.VIDEO_WATCH_KEY = VIDEO_WATCH_KEY;
    global.SETTINGS_KEY = SETTINGS_KEY;
    global.SETTINGS_LOCAL_KEY = SETTINGS_LOCAL_KEY;
    global.WATCHED_SYNC_THROTTLE = WATCHED_SYNC_THROTTLE;
    global.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
    global.LOG_LEVEL = LOG_LEVEL;

    // UI Constants
    global.HIDE_WATCHED_TOGGLE = HIDE_WATCHED_TOGGLE;
    global.HIDE_WATCHED_LABEL = HIDE_WATCHED_LABEL;
    global.MARK_ALL_WATCHED_BTN = MARK_ALL_WATCHED_BTN;
    global.SETTINGS_BTN = SETTINGS_BTN;
    global.MARK_WATCHED_BTN = MARK_WATCHED_BTN;
    global.MARK_UNWATCHED_BTN = MARK_UNWATCHED_BTN;
    global.METADATA_LINE = METADATA_LINE;
    global.HIDDEN_CLASS = HIDDEN_CLASS;

    // Mock console methods to reduce noise (but allow them to be spied on)
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Reset document body
    document.body.innerHTML = '';
});

afterEach(() => {
    // Restore console
    console.log.mockRestore?.();
    console.warn.mockRestore?.();
    console.error.mockRestore?.();
});

// Export for use in tests
module.exports = {
    DEFAULT_SETTINGS,
    PREFIX,
    VIDEO_WATCH_KEY,
    SETTINGS_KEY,
    SETTINGS_LOCAL_KEY,
    WATCHED_SYNC_THROTTLE,
    LOG_LEVEL,
    HIDE_WATCHED_TOGGLE,
    HIDE_WATCHED_LABEL,
    MARK_ALL_WATCHED_BTN,
    SETTINGS_BTN,
    MARK_WATCHED_BTN,
    MARK_UNWATCHED_BTN,
    METADATA_LINE,
    HIDDEN_CLASS
};
