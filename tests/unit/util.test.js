/**
 * Tests for util.js
 * Logging utilities and helper functions
 */

const { loadUtil } = require('../helpers/load-source');

describe('util.js', () => {
    let LOG_HEADER;

    beforeEach(() => {
        LOG_HEADER = "[YT-Better-Subs] ";
        loadUtil();

        // Restore console mocks to track calls
        console.log.mockRestore();
        console.warn.mockRestore();
        console.error.mockRestore();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('prepareMessage', () => {
        test('adds LOG_HEADER prefix to string content', () => {
            const result = prepareMessage("test message");
            expect(result).toBe(LOG_HEADER + "test message");
        });

        test('stringifies object content', () => {
            const result = prepareMessage({ key: "value" });
            expect(result).toBe(LOG_HEADER + '{"key":"value"}');
        });

        test('handles null content', () => {
            const result = prepareMessage(null);
            expect(result).toBe(LOG_HEADER);
        });

        test('handles undefined content', () => {
            const result = prepareMessage();
            expect(result).toBe(LOG_HEADER);
        });

        test('handles number content', () => {
            const result = prepareMessage(42);
            expect(result).toBe(LOG_HEADER + "42");
        });
    });

    describe('log', () => {
        test('logs when log level is INFO or higher', () => {
            global.settings = { "settings.log.level": 3 }; // INFO
            loadUtil(); // Reload with new settings
            log("info message");
            expect(console.log).toHaveBeenCalledWith(LOG_HEADER + "info message");
        });

        test('logs when log level is DEBUG', () => {
            global.settings = { "settings.log.level": 4 }; // DEBUG
            loadUtil();
            log("info message");
            expect(console.log).toHaveBeenCalledWith(LOG_HEADER + "info message");
        });

        test('does not log when log level is WARN', () => {
            global.settings = { "settings.log.level": 2 }; // WARN
            loadUtil();
            log("info message");
            expect(console.log).not.toHaveBeenCalled();
        });

        test('does not log when log level is ERROR', () => {
            global.settings = { "settings.log.level": 1 }; // ERROR
            loadUtil();
            log("info message");
            expect(console.log).not.toHaveBeenCalled();
        });
    });

    describe('logDebug', () => {
        test('logs when log level is DEBUG', () => {
            global.settings = { "settings.log.level": 4 }; // DEBUG
            loadUtil();
            logDebug("debug message");
            expect(console.log).toHaveBeenCalledWith(LOG_HEADER + "debug message");
        });

        test('does not log when log level is INFO', () => {
            global.settings = { "settings.log.level": 3 }; // INFO
            loadUtil();
            logDebug("debug message");
            expect(console.log).not.toHaveBeenCalled();
        });

        test('does not log when log level is ERROR', () => {
            global.settings = { "settings.log.level": 1 }; // ERROR
            loadUtil();
            logDebug("debug message");
            expect(console.log).not.toHaveBeenCalled();
        });
    });

    describe('logWarn', () => {
        test('logs when log level is WARN or higher', () => {
            global.settings = { "settings.log.level": 2 }; // WARN
            loadUtil();
            logWarn("warning message");
            expect(console.warn).toHaveBeenCalledWith(LOG_HEADER + "warning message");
        });

        test('logs when log level is INFO', () => {
            global.settings = { "settings.log.level": 3 }; // INFO
            loadUtil();
            logWarn("warning message");
            expect(console.warn).toHaveBeenCalledWith(LOG_HEADER + "warning message");
        });

        test('does not log when log level is ERROR', () => {
            global.settings = { "settings.log.level": 1 }; // ERROR
            loadUtil();
            logWarn("warning message");
            expect(console.warn).not.toHaveBeenCalled();
        });
    });

    describe('logError', () => {
        test('always logs errors regardless of log level', () => {
            global.settings = { "settings.log.level": 1 }; // ERROR (minimum)
            loadUtil();
            const error = { message: "error message", stack: "stack trace" };
            logError(error);
            expect(console.error).toHaveBeenCalledTimes(2);
            expect(console.error).toHaveBeenNthCalledWith(1, LOG_HEADER + "ERROR! ", "error message");
            expect(console.error).toHaveBeenNthCalledWith(2, "stack trace");
        });

        test('truncates long stack traces to 1000 characters', () => {
            global.settings = { "settings.log.level": 1 };
            loadUtil();
            const longStack = 'a'.repeat(1500);
            const error = { message: "error", stack: longStack };
            logError(error);
            expect(console.error).toHaveBeenNthCalledWith(2, 'a'.repeat(1000));
        });
    });

    describe('getLogLevel', () => {
        test('returns log level from settings', () => {
            global.settings = { "settings.log.level": 3 };
            loadUtil();
            expect(getLogLevel()).toBe(3);
        });

        test('returns ERROR level when settings.log.level is undefined', () => {
            global.settings = {};
            loadUtil();
            expect(getLogLevel()).toBe(1); // LOG_LEVEL.ERROR
        });
    });

    describe('isRendered', () => {
        test('returns true for document.body', () => {
            expect(isRendered(document.body)).toBe(true);
        });

        test('returns true for visible element', () => {
            const div = document.createElement('div');
            document.body.appendChild(div);
            expect(isRendered(div)).toBe(true);
        });

        test('returns false for element with display:none', () => {
            const div = document.createElement('div');
            div.style.display = 'none';
            document.body.appendChild(div);
            expect(isRendered(div)).toBe(false);
        });

        test('returns false for element with visibility:hidden', () => {
            const div = document.createElement('div');
            div.style.visibility = 'hidden';
            document.body.appendChild(div);
            expect(isRendered(div)).toBe(false);
        });

        test('returns false when parent is hidden', () => {
            const parent = document.createElement('div');
            parent.style.display = 'none';
            const child = document.createElement('div');
            parent.appendChild(child);
            document.body.appendChild(parent);
            expect(isRendered(child)).toBe(false);
        });

        test('returns true for nested visible element', () => {
            const parent = document.createElement('div');
            const child = document.createElement('div');
            parent.appendChild(child);
            document.body.appendChild(parent);
            expect(isRendered(child)).toBe(true);
        });
    });

    describe('download', () => {
        test('creates anchor element with correct data URI', () => {
            const appendChildSpy = jest.spyOn(document.body, 'appendChild');
            const removeChildSpy = jest.spyOn(document.body, 'removeChild');

            download('test.txt', 'file content');

            expect(appendChildSpy).toHaveBeenCalled();
            const anchor = appendChildSpy.mock.calls[0][0];

            expect(anchor.tagName).toBe('A');
            expect(anchor.getAttribute('download')).toBe('test.txt');
            expect(anchor.getAttribute('href')).toContain('data:text/plain;charset=utf-8,');
            expect(anchor.getAttribute('href')).toContain(encodeURIComponent('file content'));
            expect(anchor.style.display).toBe('none');

            expect(removeChildSpy).toHaveBeenCalled();
        });

        test('uses custom application type', () => {
            const appendChildSpy = jest.spyOn(document.body, 'appendChild');

            download('data.json', '{"key":"value"}', 'application/json');

            const anchor = appendChildSpy.mock.calls[0][0];
            expect(anchor.getAttribute('href')).toContain('data:application/json;charset=utf-8,');
        });
    });
});
