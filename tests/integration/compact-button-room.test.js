/**
 * #292: the compact mark-watched button sits under YouTube's ⋮, beside the title's second line or
 * the first metadata row. subs.css keeps card text clear of it: WATCHED is shown as an icon the
 * eye's size, so one 24px reservation on the metadata serves both states, the byline gives way
 * before the date, and the view count never shrinks. jsdom has no layout, so these tests check
 * which elements the rules reach, with the real button from subs-ui.js, swapped by clicking it.
 * jsdom's getComputedStyle applies matching stylesheet rules in source order, which here is also
 * specificity order, and only subs.css is loaded: YouTube's own styles are absent.
 */

const fs = require('fs');
const path = require('path');
const { loadUtil, loadQueries, loadSubscriptionsVideo, loadSubsUI } = require('../helpers/load-source');

const subsCss = fs.readFileSync(path.join(__dirname, '../../subs.css'), 'utf8');
const readFixture = (name) => fs.readFileSync(path.join(__dirname, '../fixtures', name), 'utf8');

const layouts = [
    {
        name: 'camelCase lockup classes',
        fixture: readFixture('subscription-feed-2026-11-camel.html'),
        menuButton: '.ytLockupMetadataViewModelMenuButton',
        title: '.ytLockupMetadataViewModelTitle',
        metadata: '.ytLockupMetadataViewModelMetadata',
        metadataText: '.ytContentMetadataViewModelMetadataText',
        metadataTextClass: 'ytContentMetadataViewModelMetadataText',
        icon: 'ytContentMetadataViewModelIcon',
        leadingIcon: 'ytContentMetadataViewModelLeadingIcon',
        delimiter: 'ytContentMetadataViewModelDelimiter',
        lastPart: 'ytContentMetadataViewModelMetadataTextLastPart',
    },
    {
        name: 'dashed lockup classes',
        fixture: readFixture('subscription-feed-2026.html'),
        menuButton: '.yt-lockup-metadata-view-model__menu-button',
        title: '.yt-lockup-metadata-view-model__title',
        metadata: '.yt-lockup-metadata-view-model__metadata',
        metadataText: '.yt-content-metadata-view-model__metadata-text',
        metadataTextClass: 'yt-content-metadata-view-model__metadata-text',
        icon: 'yt-content-metadata-view-model__icon',
        leadingIcon: 'yt-content-metadata-view-model__leading-icon',
        delimiter: 'yt-content-metadata-view-model__delimiter',
        lastPart: 'yt-content-metadata-view-model__metadata-text-last-part',
    },
];

describe.each(layouts)('compact button keeps card text clear (#292), $name', (layout) => {
    let item;

    const style = (el) => getComputedStyle(el);
    const paddingRight = (selector) => style(item.querySelector(selector)).paddingRight;
    const addButton = () => global.createSubscriptionVideo(item).addButton();
    const videoId = () => global.createSubscriptionVideo(item).videoId;
    const eye = () => item.querySelector('.subs-btn-mark-watched');
    const watched = () => item.querySelector('.subs-btn-mark-unwatched');
    const parts = () => [...item.querySelectorAll(layout.metadataText)];
    // As on live YouTube (Nov 2026): every part has role="text"; the bylines come before the ▷
    // (leading) icon, the views right after it, the date last.
    const isLeadingIcon = (el) => el != null && el.classList.contains(layout.leadingIcon);
    const bylines = () => parts().filter(part => !isLeadingIcon(part.previousElementSibling) && part.nextElementSibling);
    const views = () => parts().filter(part => isLeadingIcon(part.previousElementSibling) && part.nextElementSibling);
    const date = () => parts().find(part => !part.nextElementSibling);
    // Replace the first card's first metadata row with the live structure; collab adds "and B"
    const liveRow = (collab = false, badgeBetween = false) => {
        const row = item.querySelector(layout.metadataText).parentElement;
        // the live layout has one row; the older fixture's second row (views, date) would muddle the counts
        for (const other of [...row.parentElement.children]) if (other !== row) other.remove();
        const text = (t, extra = '') => `<span class="${layout.metadataTextClass} ${extra}" role="text">${t}</span>`;
        const delim = `<span aria-hidden="true" class="${layout.delimiter}"></span>`;
        const badge = `<span class="${layout.icon}" aria-label="Verified"></span>`;
        row.innerHTML = badgeBetween
            ? text('A Channel') + badge + delim + text('and 2 more') + delim +
                `<span class="${layout.leadingIcon}"></span>` + text('568k') + delim + text('9 days ago', layout.lastPart)
            : text('A Channel by Another Channel') + (collab ? delim + text('and Another Channel') : '') +
            badge + delim +
            `<span class="${layout.leadingIcon}"></span>` + text('615k') + delim + text('4 days ago', layout.lastPart);
    };

    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = layout.fixture;
        const sheet = document.createElement('style');
        sheet.textContent = subsCss;
        document.head.appendChild(sheet);

        loadUtil();
        loadQueries();
        // The loaded scripts hold the watchedVideos object from load time: change it, don't replace it
        global.watchedVideos = {};
        global.processSections = jest.fn();
        global.watchVideo = jest.fn();
        global.unwatchVideo = jest.fn();
        global.syncWatchedVideos = jest.fn();
        global.hideWatched = false;
        settings["settings.hide.mark.watched.button"] = false;
        settings["settings.mark.watched.button.compact"] = true;

        // Video.js captures buildMarkWatchedButton when it loads, and subs-ui.js needs the
        // SubscriptionVideo class first: forward to subs-ui's real builder once it's loaded.
        let realBuilder;
        global.buildMarkWatchedButton = (...args) => realBuilder(...args);
        loadSubscriptionsVideo();
        loadSubsUI();
        realBuilder = global.buildMarkWatchedButton;

        // A grid card with a ⋮ (the dashed fixture starts with shelf cards and shorts)
        item = [...document.querySelectorAll(vidQuery())].find(card =>
            card.querySelector(layout.menuButton) && card.querySelector(layout.metadata));
    });

    test('fixture card has a menu button, title, byline, views and date', () => {
        expect(item).toBeDefined();
        expect(item.querySelector(layout.title)).not.toBeNull();
        expect(parts().length).toBeGreaterThan(1);
        expect(date()).toBeDefined();
    });

    test('eye under the menu: centred, metadata reserves its width, the title is left to YouTube', () => {
        addButton();
        const container = item.querySelector('.subs-btn-container--compact');
        expect(container.contains(eye())).toBe(true);

        expect(style(container).left).toBe('50%');
        expect(style(eye()).width).toBe('24px');
        expect(paddingRight(layout.metadata)).toBe('24px');
        expect(['', '0px']).toContain(paddingRight(layout.title));
    });

    test('marking watched swaps in a WATCHED icon of the eye\'s size, so nothing reflows', () => {
        addButton();
        const container = item.querySelector('.subs-btn-container--compact');
        eye().click();

        expect(global.watchVideo).toHaveBeenCalledWith(videoId());
        expect(eye()).toBeNull();
        expect(container.contains(watched())).toBe(true);
        expect(style(container).left).toBe('50%');
        expect(style(watched()).width).toBe('24px');
        expect(style(watched()).maskImage).toContain('markunwatched-compact.svg');
        expect(paddingRight(layout.metadata)).toBe('24px');
        expect(['', '0px']).toContain(paddingRight(layout.title));
    });

    test('a card loaded as watched gets the same WATCHED icon and reservation', () => {
        global.watchedVideos['w' + videoId()] = Date.now();
        addButton();

        expect(item.querySelector('.subs-btn-container--compact').contains(watched())).toBe(true);
        expect(style(watched()).width).toBe('24px');
        expect(paddingRight(layout.metadata)).toBe('24px');
    });

    test('unmarking swaps the eye back in the same place', () => {
        addButton();
        const container = item.querySelector('.subs-btn-container--compact');
        eye().click();
        watched().click();

        expect(global.unwatchVideo).toHaveBeenCalledWith(videoId());
        expect(watched()).toBeNull();
        expect(container.contains(eye())).toBe(true);
        expect(paddingRight(layout.metadata)).toBe('24px');
    });

    test('both buttons are named, since the compact WATCHED has no visible word', () => {
        addButton();
        expect(eye().getAttribute('aria-label')).toBe('Mark as watched');
        expect(eye().getAttribute('title')).toBe('Mark as watched');

        eye().click();
        expect(watched().getAttribute('aria-label')).toMatch(/^Watched/);
        expect(watched().getAttribute('title')).toBe(watched().getAttribute('aria-label'));
    });

    test('non-compact setting: labelled WATCHED button and no reservation', () => {
        settings["settings.mark.watched.button.compact"] = false;
        global.watchedVideos['w' + videoId()] = Date.now();
        addButton();
        expect(item.querySelector('.subs-btn-container--bottom').contains(watched())).toBe(true);

        expect(style(watched()).width).toBe('95px');
        expect(style(watched()).maskImage).not.toContain('markunwatched-compact.svg');
        expect(paddingRight(layout.metadata)).not.toBe('24px');
    });

    test('compact fallback without a menu button: labelled WATCHED button and no reservation', () => {
        item.querySelector(layout.menuButton).remove();
        global.watchedVideos['w' + videoId()] = Date.now();
        addButton();
        expect(item.querySelector('.subs-btn-container--bottom').contains(watched())).toBe(true);

        expect(style(watched()).width).toBe('95px');
        expect(paddingRight(layout.metadata)).not.toBe('24px');
    });

    test('the byline gives way with an ellipsis; views never shrink; the date keeps YouTube\'s rules', () => {
        liveRow();
        addButton();
        expect(bylines()).toHaveLength(1);
        expect(views()).toHaveLength(1);

        for (const part of bylines()) {
            expect(style(part).flexShrink).toBe('100000');
            expect(style(part).minWidth).toBe('3em'); // keeps a few letters
            expect(style(part).overflow).toBe('hidden');
            expect(style(part).textOverflow).toBe('ellipsis');
        }
        for (const part of views()) {
            expect(style(part).flexShrink).toBe('0');
            expect(style(part).overflow).not.toBe('hidden');
        }
        // the date keeps YouTube's own values: shrink 1, cut with an ellipsis
        expect(style(date()).flexShrink).toBe('1');
    });

    test('collab byline: the first name gives way down to a few letters, then the later parts, then the date', () => {
        liveRow(true);
        addButton();

        const [first, second] = bylines();
        expect(bylines()).toHaveLength(2);
        expect(style(first).flexShrink).toBe('100000');
        expect(style(second).flexShrink).toBe('10');
        expect(style(first).minWidth).toBe('3em');
        expect(style(first).overflow).toBe('hidden');
        expect(style(first).textOverflow).toBe('ellipsis');
        expect(style(views()[0]).flexShrink).toBe('0');
        expect(style(date()).flexShrink).toBe('1');
    });

    test('collab "A and 2 more" with the badge between the names: same order of giving way', () => {
        liveRow(true, true);
        addButton();

        const [first, second] = bylines();
        expect(bylines()).toHaveLength(2);
        expect(style(first).flexShrink).toBe('100000');
        expect(style(second).flexShrink).toBe('10');
        expect(style(first).minWidth).toBe('3em');
        expect(style(views()[0]).flexShrink).toBe('0');
        expect(style(date()).flexShrink).toBe('1');
    });

    test('the older layout\'s views row (no ▷) keeps its views whole', () => {
        addButton();
        const rows = [...new Set(parts().map(part => part.parentElement))]
            .filter(row => ![...row.children].some(isLeadingIcon));
        let checked = 0;
        for (const row of rows) {
            const texts = row.querySelectorAll(layout.metadataText);
            if (row.children.length !== 3 || texts.length !== 2) continue;
            expect(style(texts[0]).flexShrink).toBe('0');
            expect(style(texts[0]).overflow).not.toBe('hidden');
            expect(style(texts[1]).flexShrink).toBe('1');
            checked++;
        }
        // only the dashed (older) fixture has such a row
        if (layout.name.startsWith('dashed')) expect(checked).toBeGreaterThan(0);
    });

    test('non-compact setting: metadata parts keep YouTube\'s rules', () => {
        settings["settings.mark.watched.button.compact"] = false;
        addButton();

        for (const part of parts()) {
            expect(style(part).flexShrink).toBe('');
            expect(style(part).overflow).not.toBe('hidden');
        }
    });
});
