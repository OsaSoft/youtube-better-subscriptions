/**
 * Colours of the "Hide watched" switch in subs.css (#293).
 *
 * ON used to be a light-grey track with a grey crossed-out eye, which read as "disabled". It now
 * copies YouTube's own switches: a translucent grey track, a blue knob on the right when ON, a grey
 * knob on the left when OFF, with the eye on the knob. These tests read the colour tokens of both
 * states in both themes and check the knob stands out from YouTube's masthead (WCAG non-text
 * contrast, at least 3:1) and the eye from the knob.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const css = fs.readFileSync(path.join(ROOT, 'subs.css'), 'utf8');

// YouTube's masthead background, sampled from the store captures in both themes
const MASTHEAD = { light: '#ffffff', dark: '#0f0f0f' };

function tokens(theme, state) {
    const selector = (theme === 'dark' ? 'html[dark] ' : '') + `.toggle-container.subs-btn-hide-watched-${state}`;
    const escaped = selector.replace(/[.[\]]/g, '\\$&');
    const block = css.match(new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`));
    if (!block) throw new Error(`No rule for "${selector}" in subs.css`);
    const result = {};
    for (const [, name, value] of block[1].matchAll(/--ybs-toggle-([a-z]+):\s*([^;]+);/g)) {
        result[name] = value.trim();
    }
    return result;
}

function rgb(hex) {
    const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) throw new Error(`Not a #rrggbb colour: ${hex}`);
    return m.slice(1).map(h => parseInt(h, 16));
}

function luminance(hex) {
    const [r, g, b] = rgb(hex).map(c => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

const isGrey = (hex) => new Set(rgb(hex)).size === 1;

describe('Hide watched switch colours (subs.css)', () => {
    const cases = [];
    for (const theme of ['light', 'dark']) {
        for (const state of ['checked', 'unchecked']) {
            const values = theme === 'light' ? tokens('light', state) : { ...tokens('light', state), ...tokens('dark', state) };
            cases.push([theme, state, values]);
        }
    }

    test.each(cases)('%s theme, %s: the knob stands out from the masthead by at least 3:1', (theme, state, t) => {
        expect(contrast(t.knob, MASTHEAD[theme])).toBeGreaterThanOrEqual(3);
    });

    test.each(cases)('%s theme, %s: the eye on the knob is legible (at least 3:1)', (theme, state, t) => {
        expect(contrast(t.icon, t.knob)).toBeGreaterThanOrEqual(3);
    });

    test.each(['light', 'dark'])('%s theme: ON is a coloured knob, OFF a grey one; the track is YouTube\'s grey', (theme) => {
        const on = cases.find(c => c[0] === theme && c[1] === 'checked')[2];
        const off = cases.find(c => c[0] === theme && c[1] === 'unchecked')[2];
        expect(isGrey(on.knob)).toBe(false);
        expect(isGrey(off.knob)).toBe(true);
        // YouTube's own track: the same grey in both states, a little more opaque when ON
        expect(on.track).toBe(theme === 'light' ? 'rgba(144, 144, 144, .5)' : 'rgba(113, 113, 113, .5)');
        expect(off.track).toBe(theme === 'light' ? 'rgba(144, 144, 144, .4)' : 'rgba(113, 113, 113, .4)');
    });

    test('the track, knob and eye are painted with the tokens checked above', () => {
        expect(css).toMatch(/\.toggle-bar \{\s*background-color: var\(--ybs-toggle-track\);\s*opacity: 1;/);
        expect(css).toMatch(/\.toggle-button \{\s*background-color: var\(--ybs-toggle-knob\);/);
        expect(css).toContain('box-shadow: 0 1px 5px 0 rgba(0, 0, 0, .6), 0 0 0 0 var(--ybs-toggle-halo)');
        expect(css).toMatch(/\.toggle-button::after \{[^}]*background-color: var\(--ybs-toggle-icon\);/);
    });

    test('the knob sits on the right when ON and on the left when OFF', () => {
        expect(css).toMatch(/\.toggle-container\.subs-btn-hide-watched-checked \.toggle-button \{\s*transform: translate\(16px, 0\);/);
        expect(css).toMatch(/\.toggle-container\.subs-btn-hide-watched-unchecked \.toggle-button \{\s*transform: none;/);
    });

    test('the knob glyphs exist and are web-accessible', () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
        const resources = manifest.web_accessible_resources.flatMap(r => r.resources);
        for (const file of ['hide-watched-on.svg', 'hide-watched-off.svg']) {
            expect(css).toContain(`url('images/${file}')`);
            expect(css).toContain(`url('chrome-extension://__MSG_@@extension_id__/images/${file}')`);
            expect(fs.existsSync(path.join(ROOT, 'images', file))).toBe(true);
        }
        expect(resources).toContain('images/*');
    });
});
