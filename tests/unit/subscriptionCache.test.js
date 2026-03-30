/**
 * Tests for subscriptionCache.js
 * isSubscribedToChannel logic (the cache building itself requires page context)
 */

const vm = require('vm');
const { loadSource, loadUtil } = require('../helpers/load-source');

describe('subscriptionCache.js', () => {
    let cacheContext;

    beforeEach(() => {
        loadUtil();

        // Mock brwsr.runtime.getURL
        global.brwsr = {
            runtime: {
                getURL: jest.fn(path => `chrome-extension://test-id/${path}`)
            }
        };

        cacheContext = loadSource('subscriptionCache.js', {
            log: global.log,
            logDebug: global.logDebug,
            logWarn: global.logWarn,
            logError: global.logError,
            brwsr: global.brwsr
        });
    });

    // Helper to set the cache from inside the VM context
    function setCache(ids) {
        vm.runInContext(
            `_subscribedChannelIds = new Set(${JSON.stringify(ids)})`,
            cacheContext
        );
    }

    describe('isSubscribedToChannel', () => {
        test('returns true (fail-open) when channelId is null', () => {
            expect(cacheContext.isSubscribedToChannel(null)).toBe(true);
        });

        test('returns true (fail-open) when channelId is empty string', () => {
            expect(cacheContext.isSubscribedToChannel('')).toBe(true);
        });

        test('returns true (fail-open) when channelId is undefined', () => {
            expect(cacheContext.isSubscribedToChannel(undefined)).toBe(true);
        });

        test('returns true (fail-open) when cache is not built (null)', () => {
            expect(cacheContext.isSubscribedToChannel('UCtest123')).toBe(true);
        });

        test('returns true (fail-open) when cache is empty set', () => {
            setCache([]);
            expect(cacheContext.isSubscribedToChannel('UCtest123')).toBe(true);
        });

        test('returns true when channel is in cache', () => {
            setCache(['UCabc', 'UCdef', 'UCghi']);
            expect(cacheContext.isSubscribedToChannel('UCdef')).toBe(true);
        });

        test('returns false when channel is not in cache', () => {
            setCache(['UCabc', 'UCdef', 'UCghi']);
            expect(cacheContext.isSubscribedToChannel('UCxyz')).toBe(false);
        });

        test('returns false for similar but non-matching channel ID', () => {
            setCache(['UCabc123']);
            expect(cacheContext.isSubscribedToChannel('UCabc124')).toBe(false);
        });
    });
});
