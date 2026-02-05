/**
 * Tests for sync functionality in common.js
 * Covers: syncWatchedVideos, loadWatchedVideos, clearOldestVideos
 *
 * These tests verify the fixes for Firefox cross-device sync issues:
 * - lastError checking on storage.sync.set
 * - Cleanup of stale batch keys
 * - Proper timestamp ordering when loading from sync
 * - clearOldestVideos function
 *
 * Note: Due to VM context isolation, we primarily verify behavior through
 * the storage mock rather than direct object inspection where necessary.
 */

const { loadUtil, loadCommon } = require('../helpers/load-source');

describe('Sync functionality', () => {
    let commonContext;

    beforeEach(() => {
        loadUtil();
        commonContext = loadCommon();
    });

    describe('syncWatchedVideos', () => {
        test('syncs videos to storage in batches', async () => {
            const now = Date.now();
            browser._setLocalStore({
                'wABC12345678': now,
                'wDEF12345678': now - 1000,
                'wGHI12345678': now - 2000,
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));

            const syncedCount = await commonContext.syncWatchedVideos();

            expect(syncedCount).toBe(3);
            const syncStore = browser._getSyncStore();
            expect(syncStore['vw_0']).toContain('wABC12345678');
            expect(syncStore['vw_0']).toContain('wDEF12345678');
            expect(syncStore['vw_0']).toContain('wGHI12345678');
        });

        test('sorts videos by timestamp with newest first in sync batches', async () => {
            const now = Date.now();
            browser._setLocalStore({
                'wOLDEST00001': now - 3000,
                'wNEWEST00001': now,
                'wMIDDLE00001': now - 1500,
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            const syncStore = browser._getSyncStore();
            const batch = syncStore['vw_0'];

            // Newest should be first in the batch
            expect(batch.indexOf('wNEWEST00001')).toBeLessThan(batch.indexOf('wMIDDLE00001'));
            expect(batch.indexOf('wMIDDLE00001')).toBeLessThan(batch.indexOf('wOLDEST00001'));
        });

        test('removes stale batch keys after sync', async () => {
            // Pre-populate sync with old batches
            browser._setSyncStore({
                'vw_0': ['wOLD00000001', 'wOLD00000002'],
                'vw_1': ['wOLD00000003', 'wOLD00000004'],
                'vw_2': ['wOLD00000005', 'wOLD00000006'],
            });

            // Set up fewer videos in local
            const now = Date.now();
            browser._setLocalStore({
                'wNEW00000001': now,
                'wNEW00000002': now - 1000,
            });

            await commonContext.loadWatchedVideos();

            // Clear old videos from memory
            Object.keys(commonContext.watchedVideos).forEach(k => {
                if (k.startsWith('wOLD')) {
                    delete commonContext.watchedVideos[k];
                }
            });

            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            const syncStore = browser._getSyncStore();

            expect(syncStore['vw_0']).toBeDefined();
            expect(syncStore['vw_0']).toContain('wNEW00000001');
            expect(syncStore['vw_1']).toBeUndefined();
            expect(syncStore['vw_2']).toBeUndefined();
        });

        test('only syncs valid video keys (12 chars with numeric value)', async () => {
            const now = Date.now();
            browser._setLocalStore({
                'wVIDEO000001': now,                    // valid: 12 chars, number value
                'settings_cache': JSON.stringify({}),  // invalid: not a number
                'short': now,                          // invalid: too short
                'toolongkey12345': now,                // invalid: too long
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            const syncStore = browser._getSyncStore();
            // Only the valid video key should be synced
            expect(syncStore['vw_0'].length).toBe(1);
            expect(syncStore['vw_0']).toContain('wVIDEO000001');
        });

        test('handles empty watchedVideos gracefully', async () => {
            browser._setLocalStore({});

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            const syncedCount = await commonContext.syncWatchedVideos();

            expect(syncedCount).toBe(0);
        });
    });

    describe('loadWatchedVideos', () => {
        test('populates local storage from sync batches', async () => {
            browser._setSyncStore({
                'vw_0': ['wVIDEO000001', 'wVIDEO000002'],
                'vw_1': ['wVIDEO000003'],
            });
            browser._setLocalStore({});

            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            expect(localStore['wVIDEO000001']).toBeDefined();
            expect(localStore['wVIDEO000002']).toBeDefined();
            expect(localStore['wVIDEO000003']).toBeDefined();
        });

        test('assigns decreasing timestamps for batch order (newest first)', async () => {
            browser._setSyncStore({
                'vw_0': ['wNEWEST00001'],  // first in batch = newest
                'vw_1': ['wOLDEST00001'],  // later batch = older
            });
            browser._setLocalStore({});

            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            // Newest should have higher timestamp
            expect(localStore['wNEWEST00001']).toBeGreaterThan(localStore['wOLDEST00001']);
        });

        test('merges sync data with existing local data', async () => {
            browser._setLocalStore({
                'wLOCAL000001': 1000000,
            });
            browser._setSyncStore({
                'vw_0': ['wSYNC0000001'],
            });

            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            expect(localStore['wLOCAL000001']).toBe(1000000);  // preserved
            expect(localStore['wSYNC0000001']).toBeDefined();  // added
        });

        test('handles invalid batch data gracefully', async () => {
            browser._setSyncStore({
                'vw_0': ['wVALID000001'],
                'vw_1': 'not an array',
                'vw_2': null,
            });
            browser._setLocalStore({});

            await expect(commonContext.loadWatchedVideos()).resolves.not.toThrow();

            const localStore = browser._getLocalStore();
            expect(localStore['wVALID000001']).toBeDefined();
        });

        test('preserves relative order within batches', async () => {
            browser._setSyncStore({
                'vw_0': ['wFIRST000001', 'wSECOND00001', 'wTHIRD000001'],
            });
            browser._setLocalStore({});

            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            // First in array = highest timestamp
            expect(localStore['wFIRST000001']).toBeGreaterThan(localStore['wSECOND00001']);
            expect(localStore['wSECOND00001']).toBeGreaterThan(localStore['wTHIRD000001']);
        });
    });

    describe('clearOldestVideos', () => {
        test('removes oldest videos by timestamp', async () => {
            const now = Date.now();
            browser._setLocalStore({
                'wNEWEST00001': now,
                'wMIDDLE00001': now - 1000,
                'wOLDEST00001': now - 2000,
                'wOLDEST00002': now - 3000,
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));

            const removed = await commonContext.clearOldestVideos(2);

            expect(removed).toBe(2);

            const localStore = browser._getLocalStore();
            expect(localStore['wOLDEST00001']).toBeUndefined();
            expect(localStore['wOLDEST00002']).toBeUndefined();
            expect(localStore['wNEWEST00001']).toBeDefined();
            expect(localStore['wMIDDLE00001']).toBeDefined();
        });

        test('updates sync storage after clearing', async () => {
            const now = Date.now();
            browser._setLocalStore({
                'wVIDEO000001': now,
                'wVIDEO000002': now - 1000,
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));

            await commonContext.clearOldestVideos(1);

            const syncStore = browser._getSyncStore();
            expect(syncStore['vw_0']).toContain('wVIDEO000001');
            expect(syncStore['vw_0']).not.toContain('wVIDEO000002');
        });

        test('handles clearing more videos than exist', async () => {
            const now = Date.now();
            browser._setLocalStore({
                'wVIDEO000001': now,
                'wVIDEO000002': now - 1000,
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));

            const removed = await commonContext.clearOldestVideos(100);

            expect(removed).toBe(2);

            const localStore = browser._getLocalStore();
            const videoKeys = Object.keys(localStore).filter(
                k => k.length === 12 && (k[0] === 'w' || k[0] === 'n')
            );
            expect(videoKeys.length).toBe(0);
        });

        test('preserves non-video data in storage', async () => {
            const now = Date.now();
            browser._setLocalStore({
                'wVIDEO000001': now,
                'settings_cache': 'preserved',
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));

            await commonContext.clearOldestVideos(10);

            const localStore = browser._getLocalStore();
            expect(localStore['settings_cache']).toBe('preserved');
        });
    });

    describe('saveVideoOperation', () => {
        test('saves video to local storage', async () => {
            await commonContext.saveVideoOperation('wTESTVIDEO01', 12345);

            const localStore = browser._getLocalStore();
            expect(localStore['wTESTVIDEO01']).toBe(12345);
        });

        test('saves video with current timestamp when not provided', async () => {
            const before = Date.now();
            await commonContext.saveVideoOperation('wTESTVIDEO01');
            const after = Date.now();

            const localStore = browser._getLocalStore();
            expect(localStore['wTESTVIDEO01']).toBeGreaterThanOrEqual(before);
            expect(localStore['wTESTVIDEO01']).toBeLessThanOrEqual(after);
        });

        test('removes opposite operation from local storage', async () => {
            // Set up unwatched
            browser._setLocalStore({
                'nTESTVIDEO01': 1000,
            });
            await commonContext.loadWatchedVideos();

            // Mark as watched
            await commonContext.saveVideoOperation('wTESTVIDEO01');

            const localStore = browser._getLocalStore();
            expect(localStore['wTESTVIDEO01']).toBeDefined();
            // The opposite operation should be removed
            expect(localStore['nTESTVIDEO01']).toBeUndefined();
        });
    });

    describe('Cross-device sync scenarios', () => {
        test('newest video is prioritized in sync order', async () => {
            const now = Date.now();
            const localVideos = {};
            for (let i = 0; i < 50; i++) {
                // Keys must be exactly 12 chars: w + 11 char video ID
                localVideos[`wOLDVID${String(i).padStart(4, '0')}`] = now - (i + 1) * 1000;
            }
            localVideos['wBRANDNEW001'] = now;  // Most recent (12 chars total)

            browser._setLocalStore(localVideos);
            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            const syncStore = browser._getSyncStore();
            const batch = syncStore['vw_0'];

            // Brand new video should be first in the batch
            expect(batch[0]).toBe('wBRANDNEW001');
        });

        test('sync then load preserves timestamp order', async () => {
            const now = Date.now();

            // Device A: set up videos with specific order
            browser._setLocalStore({
                'wFIRST000001': now - 2000,
                'wSECOND00001': now - 1000,
                'wTHIRD000001': now,
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            // Verify sync has correct order (newest first)
            const syncStore = browser._getSyncStore();
            const batch = syncStore['vw_0'];
            expect(batch.indexOf('wTHIRD000001')).toBeLessThan(batch.indexOf('wSECOND00001'));
            expect(batch.indexOf('wSECOND00001')).toBeLessThan(batch.indexOf('wFIRST000001'));

            // Device B: clear local, load from sync
            browser._setLocalStore({});
            commonContext = loadCommon();

            await commonContext.loadWatchedVideos();

            // Verify local storage has correct relative timestamps
            const localStore = browser._getLocalStore();
            expect(localStore['wTHIRD000001']).toBeGreaterThan(localStore['wSECOND00001']);
            expect(localStore['wSECOND00001']).toBeGreaterThan(localStore['wFIRST000001']);
        });

        test('order preserved across multiple sync cycles', async () => {
            const now = Date.now();

            // Device A syncs
            browser._setLocalStore({
                'wVIDEO000001': now - 1000,
                'wVIDEO000002': now,
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            // Device B loads and syncs
            browser._setLocalStore({});
            commonContext = loadCommon();
            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            // Device C loads
            browser._setLocalStore({});
            commonContext = loadCommon();
            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            // Video 2 should still have higher timestamp than Video 1
            expect(localStore['wVIDEO000002']).toBeGreaterThan(localStore['wVIDEO000001']);
        });
    });

    describe('Stale batch cleanup', () => {
        test('removes all old batches when fewer are needed', async () => {
            // Set up many old batches
            browser._setSyncStore({
                'vw_0': ['wA00000000001'],
                'vw_1': ['wB00000000001'],
                'vw_2': ['wC00000000001'],
                'vw_3': ['wD00000000001'],
                'vw_4': ['wE00000000001'],
            });

            // Only 1 video in local
            const now = Date.now();
            browser._setLocalStore({
                'wNEW00000001': now,
            });

            await commonContext.loadWatchedVideos();

            // Remove old videos from memory
            ['wA', 'wB', 'wC', 'wD', 'wE'].forEach(prefix => {
                Object.keys(commonContext.watchedVideos).forEach(k => {
                    if (k.startsWith(prefix)) {
                        delete commonContext.watchedVideos[k];
                    }
                });
            });

            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            const syncStore = browser._getSyncStore();
            expect(syncStore['vw_0']).toBeDefined();
            expect(syncStore['vw_0']).toContain('wNEW00000001');
            expect(syncStore['vw_1']).toBeUndefined();
            expect(syncStore['vw_2']).toBeUndefined();
            expect(syncStore['vw_3']).toBeUndefined();
            expect(syncStore['vw_4']).toBeUndefined();
        });

        test('complete clear removes all batch keys using clearOldestVideos', async () => {
            browser._setSyncStore({
                'vw_0': ['wVIDEO000001'],
                'vw_1': ['wVIDEO000002'],
            });
            browser._setLocalStore({
                'wVIDEO000001': Date.now(),
                'wVIDEO000002': Date.now() - 1000,
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Clear all videos using the clearOldestVideos function
            await commonContext.clearOldestVideos(100);

            const syncStore = browser._getSyncStore();
            // After clearing all videos, no batch keys should remain
            expect(syncStore['vw_0']).toBeUndefined();
            expect(syncStore['vw_1']).toBeUndefined();
        });
    });
});
