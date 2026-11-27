/**
 * Title patterns (#70): parsing and matching in common.js
 */

const { loadCommon } = require('../helpers/load-source');

describe('title patterns (#70)', () => {
    beforeEach(() => {
        loadCommon();
    });

    test('the setting defaults to no patterns', () => {
        expect(DEFAULT_SETTINGS['settings.hide.title.patterns']).toBe('');
    });

    test('sync storage keeps room for the patterns to grow to their cap', () => {
        expect(MAX_TITLE_PATTERNS_BYTES).toBe(1024);
        // channel exceptions cap + title patterns cap + slack for the other settings
        expect(SYNC_RESERVED_BYTES).toBe(1024 + MAX_TITLE_PATTERNS_BYTES + 512);
    });

    describe('parseTitlePatterns', () => {
        test('one pattern per line, trimmed, blank lines ignored, numbered as typed', () => {
            const { patterns, errors } = parseTitlePatterns('  trailer \n\n   \nlive stream\r\nGTA (6|VI)\n');
            expect(patterns.map(p => [p.line, p.source])).toEqual([[1, 'trailer'], [4, 'live stream'], [5, 'GTA (6|VI)']]);
            expect(errors).toEqual([]);
        });

        test('compiles each line case-insensitively, without the stateful g/y flags', () => {
            const { patterns } = parseTitlePatterns('abc');
            expect(patterns[0].regex.flags).toBe('i');
        });

        test('reports invalid lines with their line number and skips them', () => {
            const { patterns, errors } = parseTitlePatterns('ok\n(unclosed\n[z-a]\nfine');
            expect(patterns.map(p => p.source)).toEqual(['ok', 'fine']);
            expect(errors.map(e => [e.line, e.source])).toEqual([[2, '(unclosed'], [3, '[z-a]']]);
            expect(errors[0].message).toBeTruthy();
        });

        test('spaces at the ends of a line are ignored', () => {
            expect(parseTitlePatterns('  live  ').patterns[0].source).toBe('live');
        });

        test.each(['trailer|', '|', '.*', 'x*', '()', '^', 'a?'])('%j matches every title, so it is reported and skipped', (line) => {
            const { patterns, errors } = parseTitlePatterns('ok\n' + line);
            expect(patterns.map(p => p.source)).toEqual(['ok']);
            expect(errors).toEqual([{ line: 2, source: line, message: 'it matches every title' }]);
            expect(matchesTitlePattern('Any title at all', line)).toBe(false);
        });

        test('the reason for an invalid line leaves out the browser\'s "Invalid regular expression: /…/i:" prefix', () => {
            const [error] = parseTitlePatterns('(unclosed').errors;
            expect(error.message).not.toMatch(/Invalid regular expression|\/i:/);
            expect(error.message).toBeTruthy();
        });

        test.each([['', 0], ['\n\n  \n', 0], [undefined, 0], [null, 0], [42, 0]])('%j gives no patterns and no errors', (text) => {
            expect(parseTitlePatterns(text)).toEqual({ patterns: [], errors: [] });
        });
    });

    describe('matchesTitlePattern', () => {
        test('a plain word matches anywhere in the title, ignoring case', () => {
            expect(matchesTitlePattern('AVENGERS DOOMSDAY TRAILER BREAKDOWN', 'doomsday')).toBe(true);
            expect(matchesTitlePattern('Avengers Doomsday Theories', 'DOOMSDAY')).toBe(true);
            expect(matchesTitlePattern('Mac Gaming is Solved', 'doomsday')).toBe(false);
        });

        test('lines are regular expressions', () => {
            const text = 'gta (6|vi)\n^why\\b';
            expect(matchesTitlePattern('GTA 6 Prologue Breakdown!', text)).toBe(true);
            expect(matchesTitlePattern('Comparing GTA VI on Every Console', text)).toBe(true);
            expect(matchesTitlePattern('GTA 5 retrospective', text)).toBe(false);
            expect(matchesTitlePattern('Why Working On Fridays Is Worse', text)).toBe(true);
            expect(matchesTitlePattern('Here is why', text)).toBe(false);
            expect(matchesTitlePattern('Whyever not', text)).toBe(false);
        });

        test('an invalid line is skipped, never thrown, and the other lines still match', () => {
            const text = '(unclosed\n*\nbigfoot';
            expect(() => matchesTitlePattern('anything', text)).not.toThrow();
            expect(matchesTitlePattern("U.S. Government Releases 'The Bigfoot Files'", text)).toBe(true);
            expect(matchesTitlePattern('(unclosed', text)).toBe(false);
        });

        test('no patterns match nothing', () => {
            for (const text of ['', '\n \n', undefined, null]) {
                expect(matchesTitlePattern('Any title', text)).toBe(false);
            }
        });

        test('an empty or missing title never matches, even a pattern that matches anything', () => {
            for (const title of ['', '   ', null, undefined]) {
                expect(matchesTitlePattern(title, '.+')).toBe(false);
            }
        });

        test('gives the same answer every time (no regex state between calls)', () => {
            for (let i = 0; i < 3; i++) {
                expect(matchesTitlePattern('trailer one', 'trailer')).toBe(true);
            }
        });
    });

    describe('getTitlePatterns', () => {
        test('compiles a text once and again only when it changes', () => {
            const first = getTitlePatterns('a\nb');
            expect(first).toHaveLength(2);
            expect(getTitlePatterns('a\nb')).toBe(first);
            const changed = getTitlePatterns('a\nb\nc');
            expect(changed).not.toBe(first);
            expect(changed).toHaveLength(3);
        });
    });

    describe('getTitlePatternsBytes', () => {
        test('counts the JSON string in UTF-8, as sync storage does', () => {
            expect(getTitlePatternsBytes('')).toBe(2);
            expect(getTitlePatternsBytes('abc')).toBe(5);
            expect(getTitlePatternsBytes('\\d')).toBe(5); // a backslash is escaped in JSON: "\\d"
            expect(getTitlePatternsBytes('a\nb')).toBe(6); // so is a line break
            expect(getTitlePatternsBytes('é')).toBe(4);
            expect(getTitlePatternsBytes(undefined)).toBe(2);
        });
    });
});
