/**
 * Browser API Mock Factory
 * Creates mocks for browser.storage.sync, browser.storage.local, and browser.runtime
 */

function createStorageMock() {
    let syncStore = {};
    let localStore = {};
    const changeListeners = [];

    const filterStore = (store, keys) => {
        if (keys === null) {
            return { ...store };
        }
        if (typeof keys === 'string') {
            return keys in store ? { [keys]: store[keys] } : {};
        }
        if (Array.isArray(keys)) {
            const result = {};
            for (const key of keys) {
                if (key in store) {
                    result[key] = store[key];
                }
            }
            return result;
        }
        // Object with default values
        const result = {};
        for (const key in keys) {
            result[key] = key in store ? store[key] : keys[key];
        }
        return result;
    };

    return {
        storage: {
            sync: {
                get: jest.fn((keys, callback) => {
                    const result = filterStore(syncStore, keys);
                    if (callback) {
                        callback(result);
                        return;
                    }
                    return Promise.resolve(result);
                }),
                set: jest.fn((items, callback) => {
                    const oldItems = { ...syncStore };
                    Object.assign(syncStore, items);

                    // Notify change listeners
                    const changes = {};
                    for (const key in items) {
                        changes[key] = {
                            oldValue: oldItems[key],
                            newValue: items[key]
                        };
                    }
                    for (const listener of changeListeners) {
                        listener(changes, 'sync');
                    }

                    if (callback) {
                        callback();
                        return;
                    }
                    return Promise.resolve();
                }),
                remove: jest.fn((keys, callback) => {
                    const keysArray = Array.isArray(keys) ? keys : [keys];
                    for (const key of keysArray) {
                        delete syncStore[key];
                    }
                    if (callback) {
                        callback();
                        return;
                    }
                    return Promise.resolve();
                }),
                clear: jest.fn((callback) => {
                    syncStore = {};
                    if (callback) {
                        callback();
                        return;
                    }
                    return Promise.resolve();
                })
            },
            local: {
                get: jest.fn((keys, callback) => {
                    const result = filterStore(localStore, keys);
                    if (callback) {
                        callback(result);
                        return;
                    }
                    return Promise.resolve(result);
                }),
                set: jest.fn((items, callback) => {
                    Object.assign(localStore, items);
                    if (callback) {
                        callback();
                        return;
                    }
                    return Promise.resolve();
                }),
                remove: jest.fn((keys, callback) => {
                    const keysArray = Array.isArray(keys) ? keys : [keys];
                    for (const key of keysArray) {
                        delete localStore[key];
                    }
                    if (callback) {
                        callback();
                        return;
                    }
                    return Promise.resolve();
                }),
                clear: jest.fn((callback) => {
                    localStore = {};
                    if (callback) {
                        callback();
                        return;
                    }
                    return Promise.resolve();
                })
            },
            onChanged: {
                addListener: jest.fn((callback) => {
                    changeListeners.push(callback);
                }),
                removeListener: jest.fn((callback) => {
                    const index = changeListeners.indexOf(callback);
                    if (index > -1) {
                        changeListeners.splice(index, 1);
                    }
                })
            }
        },
        runtime: {
            getURL: jest.fn((path) => `chrome-extension://test-extension-id/${path}`),
            sendMessage: jest.fn(() => Promise.resolve()),
            onMessage: {
                addListener: jest.fn(),
                removeListener: jest.fn()
            },
            lastError: null
        },
        // Helper methods for tests
        _getSyncStore: () => syncStore,
        _getLocalStore: () => localStore,
        _setSyncStore: (data) => { syncStore = { ...data }; },
        _setLocalStore: (data) => { localStore = { ...data }; },
        _clearStores: () => {
            syncStore = {};
            localStore = {};
        },
        _triggerStorageChange: (changes, areaName) => {
            for (const listener of changeListeners) {
                listener(changes, areaName);
            }
        }
    };
}

module.exports = { createStorageMock };
