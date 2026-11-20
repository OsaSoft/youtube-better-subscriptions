/**
 * Tests for common.js
 * Storage management, settings, and watched videos tracking
 */

const { loadUtil, loadCommon } = require('../helpers/load-source');

describe('common.js', () => {
    let commonContext;

    beforeEach(() => {
        // Load dependencies
        loadUtil();
        commonContext = loadCommon();
    });

    describe('syncStorageGet', () => {
        test('returns promise that resolves with sync storage data', async () => {
            browser._setSyncStore({ 'key1': 'value1', 'key2': 'value2' });

            const result = await commonContext.syncStorageGet(['key1']);

            expect(result).toEqual({ 'key1': 'value1' });
        });

        test('returns all data when keys is null', async () => {
            browser._setSyncStore({ 'key1': 'value1', 'key2': 'value2' });

            const result = await commonContext.syncStorageGet(null);

            expect(result).toEqual({ 'key1': 'value1', 'key2': 'value2' });
        });
    });

    describe('localStorageGet', () => {
        test('returns promise that resolves with local storage data', async () => {
            browser._setLocalStore({ 'localKey': 'localValue' });

            const result = await commonContext.localStorageGet(['localKey']);

            expect(result).toEqual({ 'localKey': 'localValue' });
        });
    });

    // loadWatchedVideos, syncWatchedVideos and more saveVideoOperation cases: see sync.test.js

    describe('saveVideoOperation', () => {
        test('keeps the first timestamp of an operation it already has', async () => {
            await commonContext.saveVideoOperation('wTESTVIDEO01', 1000);
            await commonContext.saveVideoOperation('wTESTVIDEO01', 2000);

            expect(browser._getLocalStore()['wTESTVIDEO01']).toBe(1000);
        });
    });

    describe('watchVideo', () => {
        test('stores the video as watched', async () => {
            await commonContext.watchVideo('TESTVIDEO01', 1000);

            expect(browser._getLocalStore()).toEqual({ 'wTESTVIDEO01': 1000 });
        });
    });

    describe('unwatchVideo', () => {
        test('replaces a watched video with an unwatched one', async () => {
            await commonContext.watchVideo('TESTVIDEO01', 1000);
            commonContext.unwatchVideo('TESTVIDEO01', 2000);

            expect(browser._getLocalStore()).toEqual({ 'nTESTVIDEO01': 2000 });
        });

        test('watching again afterwards replaces the unwatched one', async () => {
            commonContext.unwatchVideo('TESTVIDEO01', 1000);
            await commonContext.watchVideo('TESTVIDEO01', 2000);

            expect(browser._getLocalStore()).toEqual({ 'wTESTVIDEO01': 2000 });
        });
    });

    describe('getCurrentPage', () => {
        afterEach(() => window.history.replaceState(null, '', '/'));

        test('returns the path without a trailing slash', () => {
            window.history.replaceState(null, '', '/feed/subscriptions/');
            expect(commonContext.getCurrentPage()).toBe('/feed/subscriptions');
            expect(commonContext.isSubscriptionsPage()).toBe(true);
        });

        test('ignores the query string', () => {
            window.history.replaceState(null, '', '/watch?v=abc12345678');
            expect(commonContext.getCurrentPage()).toBe('/watch');
            expect(commonContext.isSubscriptionsPage()).toBe(false);
        });

        test('is empty on the home page', () => {
            window.history.replaceState(null, '', '/');
            expect(commonContext.getCurrentPage()).toBe('');
        });
    });

    describe('getSyncCountWarning', () => {
        test('returns null when sync has all local videos', () => {
            expect(commonContext.getSyncCountWarning(1200, 1200, 26000)).toBeNull();
        });

        test('returns null when sync has more videos than local', () => {
            expect(commonContext.getSyncCountWarning(10, 1200, 26000)).toBeNull();
        });

        test('reports quota limit when sync storage is nearly full', () => {
            const warning = commonContext.getSyncCountWarning(5000, 4500, 100500);

            expect(warning).toContain("500 videos not synced due to storage quota limit");
        });

        test('quota warning starts at 95% of the sync quota', () => {
            const quotaThreshold = 102400 * 0.95;

            expect(commonContext.getSyncCountWarning(5000, 4500, quotaThreshold)).toContain("storage quota limit");
            expect(commonContext.getSyncCountWarning(5000, 4500, quotaThreshold - 1)).not.toContain("quota");
        });

        test('reports pending sync, not quota, when sync storage has room', () => {
            // Device whose sync storage copy is still stale (#271)
            const warning = commonContext.getSyncCountWarning(1200, 200, 4500);

            expect(warning).toContain("1000 videos on this device are not in sync storage yet");
            expect(warning).toContain("Sync Now");
            expect(warning).not.toContain("quota");
        });
    });
});
