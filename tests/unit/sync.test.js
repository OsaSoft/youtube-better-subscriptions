/**
 * Tests for sync functionality in common.js
 * Covers: syncWatchedVideos, loadWatchedVideos, clearOldestVideos
 *
 * These tests verify the fixes for Firefox cross-device sync issues:
 * - lastError checking on storage.sync.set
 * - Cleanup of stale batch keys
 * - Proper timestamp ordering when loading from sync
 * - clearOldestVideos function
 * - v2 sync format with real timestamps
 *
 * Note: Due to VM context isolation, we primarily verify behavior through
 * the storage mock rather than direct object inspection where necessary.
 */

const { loadUtil, loadCommon } = require('../helpers/load-source');

// Helper: check if batch contains an entry starting with the given operation
function batchHasEntry(batch, operationPrefix) {
    return batch.some(e => e.startsWith(operationPrefix + ':') || e === operationPrefix);
}

// Helper: get index of entry by operation prefix
function entryIndex(batch, operationPrefix) {
    return batch.findIndex(e => e.startsWith(operationPrefix + ':') || e === operationPrefix);
}

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
            expect(batchHasEntry(syncStore['vw_0'], 'wABC12345678')).toBe(true);
            expect(batchHasEntry(syncStore['vw_0'], 'wDEF12345678')).toBe(true);
            expect(batchHasEntry(syncStore['vw_0'], 'wGHI12345678')).toBe(true);
        });

        test('writes vw_meta with version 2', async () => {
            const now = Date.now();
            browser._setLocalStore({
                'wVIDEO000001': now,
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            const syncStore = browser._getSyncStore();
            expect(syncStore['vw_meta']).toEqual({ version: 2 });
        });

        test('packs entries with timestamps', async () => {
            const now = Date.now();
            browser._setLocalStore({
                'wVIDEO000001': now,
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            const syncStore = browser._getSyncStore();
            const entry = syncStore['vw_0'][0];

            // Entry should be packed: "wVIDEO000001:<base36timestamp>"
            expect(entry).toMatch(/^wVIDEO000001:/);
            const parts = entry.split(':');
            expect(parts.length).toBe(2);
            // Decode the timestamp and verify it matches (within 1 second)
            const decoded = parseInt(parts[1], 36) * 1000;
            expect(Math.abs(decoded - now)).toBeLessThan(1000);
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
            expect(entryIndex(batch, 'wNEWEST00001')).toBeLessThan(entryIndex(batch, 'wMIDDLE00001'));
            expect(entryIndex(batch, 'wMIDDLE00001')).toBeLessThan(entryIndex(batch, 'wOLDEST00001'));
        });

        test('removes stale batch keys after sync', async () => {
            // Pre-populate sync with old batches (v1 format — no vw_meta)
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
            expect(batchHasEntry(syncStore['vw_0'], 'wNEW00000001')).toBe(true);
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
            expect(batchHasEntry(syncStore['vw_0'], 'wVIDEO000001')).toBe(true);
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
        test('populates local storage from sync batches (v1 format)', async () => {
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

        test('assigns decreasing timestamps for v1 batch order (newest first)', async () => {
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

        test('preserves relative order within v1 batches', async () => {
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

        test('loads v2 format with real timestamps', async () => {
            const realTimestamp1 = 1700000000000; // Nov 2023
            const realTimestamp2 = 1600000000000; // Sep 2020
            const encoded1 = Math.floor(realTimestamp1 / 1000).toString(36);
            const encoded2 = Math.floor(realTimestamp2 / 1000).toString(36);

            browser._setSyncStore({
                'vw_meta': { version: 2 },
                'vw_0': [
                    'wVIDEO000001:' + encoded1,
                    'wVIDEO000002:' + encoded2,
                ],
            });
            browser._setLocalStore({});

            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            // Timestamps should match the originals (within 1s precision)
            expect(Math.abs(localStore['wVIDEO000001'] - realTimestamp1)).toBeLessThan(1000);
            expect(Math.abs(localStore['wVIDEO000002'] - realTimestamp2)).toBeLessThan(1000);
        });

        test('skips vw_meta key during batch iteration', async () => {
            browser._setSyncStore({
                'vw_meta': { version: 2 },
                'vw_0': [
                    'wVIDEO000001:' + Math.floor(Date.now() / 1000).toString(36),
                ],
            });
            browser._setLocalStore({});

            // Should not throw or produce NaN warnings from parseInt("meta")
            await expect(commonContext.loadWatchedVideos()).resolves.not.toThrow();

            const localStore = browser._getLocalStore();
            expect(localStore['wVIDEO000001']).toBeDefined();
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
            expect(batchHasEntry(syncStore['vw_0'], 'wVIDEO000001')).toBe(true);
            expect(batchHasEntry(syncStore['vw_0'], 'wVIDEO000002')).toBe(false);
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

            // Brand new video should be first in the batch with a valid timestamp
            expect(batch[0].startsWith('wBRANDNEW001:')).toBe(true);
            const decodedTs = parseInt(batch[0].split(':')[1], 36) * 1000;
            expect(Math.abs(decodedTs - now)).toBeLessThan(1000);
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
            expect(entryIndex(batch, 'wTHIRD000001')).toBeLessThan(entryIndex(batch, 'wSECOND00001'));
            expect(entryIndex(batch, 'wSECOND00001')).toBeLessThan(entryIndex(batch, 'wFIRST000001'));

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

        test('cross-device load preserves real timestamps (core bug fix)', async () => {
            const now = Date.now();
            const oldTimestamp = now - 86400000; // 1 day ago
            const newTimestamp = now;

            // Device A: set up videos with real age difference
            browser._setLocalStore({
                'wOLDVIDEO001': oldTimestamp,
                'wNEWVIDEO001': newTimestamp,
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            // Device B: empty local, load from sync
            browser._setLocalStore({});
            commonContext = loadCommon();
            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();

            // With v2, the old video should have a timestamp ~1 day ago, not near "now"
            // The difference should be preserved (within 1s precision from base-36 encoding)
            const timeDiff = localStore['wNEWVIDEO001'] - localStore['wOLDVIDEO001'];
            expect(timeDiff).toBeGreaterThan(80000000); // ~22+ hours preserved
        });

        test('clearOldestVideos correctly identifies truly oldest after cross-device load', async () => {
            const now = Date.now();
            const veryOld = now - 7 * 86400000; // 1 week ago
            const recent = now - 3600000;        // 1 hour ago

            // Device A syncs
            browser._setLocalStore({
                'wANCIENT0001': veryOld,
                'wRECENT00001': recent,
                'wBRANDNW0001': now,
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            // Device B loads from sync (empty local)
            browser._setLocalStore({});
            commonContext = loadCommon();
            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Clear 1 oldest — should remove the ancient one, not the new one
            await commonContext.clearOldestVideos(1);

            const localStore = browser._getLocalStore();
            expect(localStore['wANCIENT0001']).toBeUndefined(); // oldest removed
            expect(localStore['wRECENT00001']).toBeDefined();   // kept
            expect(localStore['wBRANDNW0001']).toBeDefined();   // kept
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
            expect(batchHasEntry(syncStore['vw_0'], 'wNEW00000001')).toBe(true);
            expect(syncStore['vw_1']).toBeUndefined();
            expect(syncStore['vw_2']).toBeUndefined();
            expect(syncStore['vw_3']).toBeUndefined();
            expect(syncStore['vw_4']).toBeUndefined();
            // vw_meta should persist
            expect(syncStore['vw_meta']).toEqual({ version: 2 });
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

    describe('v1 to v2 migration', () => {
        test('v1 data migrated to v2 on first sync after upgrade', async () => {
            // Simulate v1 sync data (no vw_meta, plain operation strings)
            browser._setSyncStore({
                'vw_0': ['wVIDEO000001', 'wVIDEO000002'],
            });
            browser._setLocalStore({});

            // Load (v1 path — synthetic timestamps)
            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Sync back — should now write v2 format
            await commonContext.syncWatchedVideos();

            const syncStore = browser._getSyncStore();
            // Should have vw_meta now
            expect(syncStore['vw_meta']).toEqual({ version: 2 });
            // Entries should be packed with timestamps
            expect(syncStore['vw_0'][0]).toMatch(/^w.+:.+$/);
        });

        test('v1 synthetic timestamps maintain relative order after migration', async () => {
            // v1 format: ordered, newest first
            browser._setSyncStore({
                'vw_0': ['wNEWER000001', 'wOLDER000001'],
            });
            browser._setLocalStore({});

            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            // v1 should give NEWER a higher timestamp than OLDER
            expect(localStore['wNEWER000001']).toBeGreaterThan(localStore['wOLDER000001']);
        });
    });

    describe('Packed entry helpers', () => {
        test('encodeTimestamp and decodeTimestamp are inverses', () => {
            const now = Date.now();
            const encoded = commonContext.encodeTimestamp(now);
            const decoded = commonContext.decodeTimestamp(encoded);
            // Should be within 1 second (sub-second precision lost)
            expect(Math.abs(decoded - now)).toBeLessThan(1000);
        });

        test('packSyncEntry creates colon-separated format', () => {
            const packed = commonContext.packSyncEntry('wABCDEFGH001', 1700000000000);
            expect(packed).toMatch(/^wABCDEFGH001:.+$/);
            expect(packed.split(':').length).toBe(2);
        });

        test('unpackSyncEntry handles v2 packed entry', () => {
            const ts = 1700000000000;
            const encoded = Math.floor(ts / 1000).toString(36);
            const packed = 'wVIDEO000001:' + encoded;

            const result = commonContext.unpackSyncEntry(packed);
            expect(result.operation).toBe('wVIDEO000001');
            expect(Math.abs(result.timestamp - ts)).toBeLessThan(1000);
        });

        test('unpackSyncEntry handles v1 plain entry', () => {
            const result = commonContext.unpackSyncEntry('wVIDEO000001');
            expect(result.operation).toBe('wVIDEO000001');
            expect(result.timestamp).toBeNull();
        });

        test('packed entries fail old v1 12-char filter', () => {
            // This verifies backwards compatibility: old code checking key.length === 12
            // will not match packed entries (which are ~19 chars)
            const packed = commonContext.packSyncEntry('wVIDEO000001', Date.now());
            expect(packed.length).toBeGreaterThan(12);
        });
    });

    describe('Sync-propagated clear', () => {
        test('detects clearedAt and clears local video data', async () => {
            const clearTime = Date.now();

            browser._setSyncStore({
                'vw_meta': { version: 2, clearedAt: clearTime },
            });
            browser._setLocalStore({
                'wVIDEO000001': clearTime - 5000,
                'wVIDEO000002': clearTime - 3000,
                'settings_cache': 'preserved',
            });

            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            expect(localStore['wVIDEO000001']).toBeUndefined();
            expect(localStore['wVIDEO000002']).toBeUndefined();
            expect(localStore['settings_cache']).toBe('preserved');
            expect(localStore['vw_last_cleared']).toBe(clearTime);
        });

        test('repeated loads do not re-clear when vw_last_cleared matches', async () => {
            const clearTime = Date.now();

            browser._setSyncStore({
                'vw_meta': { version: 2, clearedAt: clearTime },
            });
            browser._setLocalStore({
                'vw_last_cleared': clearTime,
                'wVIDEO000001': clearTime + 1000,
            });

            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            // Video added after the clear should be preserved
            expect(localStore['wVIDEO000001']).toBe(clearTime + 1000);
        });

        test('syncWatchedVideos preserves clearedAt in vw_meta', async () => {
            const clearTime = Date.now() - 5000;
            const now = Date.now();

            browser._setSyncStore({
                'vw_meta': { version: 2, clearedAt: clearTime },
            });
            browser._setLocalStore({
                'vw_last_cleared': clearTime,
                'wVIDEO000001': now,
            });

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            const syncStore = browser._getSyncStore();
            expect(syncStore['vw_meta'].version).toBe(2);
            expect(syncStore['vw_meta'].clearedAt).toBe(clearTime);
        });

        test('full cross-device flow: Device A has data, Device B clears, Device A loads and clears', async () => {
            const now = Date.now();

            // Device A: has videos in local
            browser._setLocalStore({
                'wVIDEO000001': now - 5000,
                'wVIDEO000002': now - 3000,
                'wVIDEO000003': now - 1000,
            });
            browser._setSyncStore({});

            await commonContext.loadWatchedVideos();
            await new Promise(resolve => setTimeout(resolve, 1100));
            await commonContext.syncWatchedVideos();

            // Device B clears with propagation: writes clearedAt to sync, removes batches
            const clearTime = Date.now();
            browser._setSyncStore({
                'vw_meta': { version: 2, clearedAt: clearTime },
            });

            // Device A reloads (still has local data)
            commonContext = loadCommon();
            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            expect(localStore['wVIDEO000001']).toBeUndefined();
            expect(localStore['wVIDEO000002']).toBeUndefined();
            expect(localStore['wVIDEO000003']).toBeUndefined();
            expect(localStore['vw_last_cleared']).toBe(clearTime);
        });

        test('new videos added after clear by another device are preserved', async () => {
            const clearTime = Date.now() - 2000;
            const now = Date.now();
            const encoded = Math.floor(now / 1000).toString(36);

            // Sync has clearedAt AND a new video added after the clear
            browser._setSyncStore({
                'vw_meta': { version: 2, clearedAt: clearTime },
                'vw_0': ['wNEWVIDEO001:' + encoded],
            });
            // Local has old videos that should be cleared
            browser._setLocalStore({
                'wOLDVIDEO001': clearTime - 5000,
                'wOLDVIDEO002': clearTime - 3000,
            });

            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            // Old videos should be cleared
            expect(localStore['wOLDVIDEO001']).toBeUndefined();
            expect(localStore['wOLDVIDEO002']).toBeUndefined();
            // New video from sync should be preserved (added after clear ran)
            expect(localStore['wNEWVIDEO001']).toBeDefined();
        });

        test('same-device clear does not re-trigger', async () => {
            const clearTime = Date.now();

            // Simulate same device already cleared: vw_last_cleared matches clearedAt
            browser._setSyncStore({
                'vw_meta': { version: 2, clearedAt: clearTime },
            });
            browser._setLocalStore({
                'vw_last_cleared': clearTime,
                'wNEWVIDEO001': clearTime + 500,
            });

            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            // Should not have cleared the new video
            expect(localStore['wNEWVIDEO001']).toBe(clearTime + 500);
        });

        test('device coming online much later still detects clearedAt', async () => {
            const clearTime = Date.now() - 7 * 86400000; // 1 week ago

            browser._setSyncStore({
                'vw_meta': { version: 2, clearedAt: clearTime },
            });
            // Device has no vw_last_cleared (never seen the clear before)
            browser._setLocalStore({
                'wOLDVIDEO001': clearTime - 30 * 86400000,
                'wOLDVIDEO002': clearTime - 20 * 86400000,
            });

            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            expect(localStore['wOLDVIDEO001']).toBeUndefined();
            expect(localStore['wOLDVIDEO002']).toBeUndefined();
            expect(localStore['vw_last_cleared']).toBe(clearTime);
        });
    });

    describe('Malformed entry handling', () => {
        test('unpackSyncEntry returns null operation for non-string inputs', () => {
            for (const input of [null, undefined, 42, {}, []]) {
                const result = commonContext.unpackSyncEntry(input);
                expect(result.operation).toBeNull();
                expect(result.timestamp).toBeNull();
            }
        });

        test('loadWatchedVideos skips non-string entries in v2 batches', async () => {
            browser._setSyncStore({
                'vw_meta': { version: 2 },
                'vw_0': [
                    commonContext.packSyncEntry('wGOODVIDEO01', 1700000000000),
                    null,
                    undefined,
                    42,
                ],
            });
            browser._setLocalStore({});

            await commonContext.loadWatchedVideos();

            const localStore = browser._getLocalStore();
            // Good entry should be persisted
            expect(localStore['wGOODVIDEO01']).toBeDefined();
            // Corrupted entries should NOT be persisted
            expect(localStore['null']).toBeUndefined();
            expect(localStore['undefined']).toBeUndefined();
            expect(localStore['42']).toBeUndefined();
        });

        test('v2 entry without timestamp uses current time', async () => {
            const before = Date.now();

            browser._setSyncStore({
                'vw_meta': { version: 2 },
                'vw_0': ['wMALFORMED01'],  // no colon, no timestamp
            });
            browser._setLocalStore({});

            await commonContext.loadWatchedVideos();

            const after = Date.now();
            const localStore = browser._getLocalStore();
            // Should be saved with current time as fallback
            expect(localStore['wMALFORMED01']).toBeGreaterThanOrEqual(before);
            expect(localStore['wMALFORMED01']).toBeLessThanOrEqual(after);
        });
    });
});
