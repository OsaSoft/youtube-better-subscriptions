/**
 * Settings icon in the masthead (#294).
 *
 * The icon used to be a background image whose SVG filled the sliders white: outlined on YouTube's
 * white light theme, but white filled bars on the dark one. It is now a mask over a background
 * colour, so both themes draw the same outline in YouTube's icon colour for the theme.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const css = fs.readFileSync(path.join(root, 'subs.css'), 'utf8');
const svg = fs.readFileSync(path.join(root, 'images/icon_settings.svg'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

function rule(selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`));
    return match ? match[1] : null;
}

describe('settings icon', () => {
    test('the SVG draws only an outline, so it works as a mask', () => {
        expect(svg).toMatch(/fill="none"/);
        expect(svg).not.toMatch(/fill="(?!none)/);
    });

    test('the 1px outline sits on the pixel grid, so it is drawn at full colour, not half-alpha grey', () => {
        // the path's edges are on whole coordinates: without the offset a 1px stroke covers two pixels by half
        expect(svg).toMatch(/<g id="settings" transform="translate\(\.5 \.5\)">/);
        expect(svg).not.toMatch(/stroke-width/);
    });

    test('the icon is a mask in YouTube\'s light icon colour, with both URL fallbacks', () => {
        const light = rule('.subs-btn-settings');
        expect(light).not.toBeNull();
        expect(light).not.toMatch(/background-image/);
        expect(light).toMatch(/background-color:\s*#0f0f0f/);
        for (const prop of ['-webkit-mask-image', 'mask-image']) {
            const decl = light.match(new RegExp(`(?:^|[;\\s])${prop}:([^;]*);`));
            expect(decl).not.toBeNull();
            expect(decl[1]).toContain("url('images/icon_settings.svg')");
            expect(decl[1]).toContain("url('chrome-extension://__MSG_@@extension_id__/images/icon_settings.svg')");
        }
        expect(light).toMatch(/(?:^|[;\s])mask-repeat:\s*no-repeat/);
        expect(light).toMatch(/-webkit-mask-repeat:\s*no-repeat/);
    });

    test('the dark theme only changes the colour', () => {
        const dark = rule('html[dark] .subs-btn-settings');
        expect(dark).not.toBeNull();
        expect(dark.trim()).toBe('background-color: #f1f1f1;');
    });

    test('the SVG is a web accessible resource on YouTube', () => {
        const covered = manifest.web_accessible_resources.some(entry =>
            entry.matches.some(m => m.includes('youtube.com')) &&
            entry.resources.some(r => r === 'images/icon_settings.svg' || r === 'images/*'));
        expect(covered).toBe(true);
    });
});
