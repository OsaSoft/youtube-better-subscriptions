// Harness --actions script that captures the raw screenshots for the store listing images.
//
//   node tools/visual/harness.mjs record --ext . --seed tools/store/seed.json \
//       --actions tools/store/capture.mjs --out pr-media/store --seconds 1
//   node tools/visual/harness.mjs record --ext . --seed tools/store/seed.json \
//       --actions tools/store/capture.mjs --out pr-media/store --seconds 1 --theme dark
//
// Light run: feed-hide (hero), feed-stop, marquee-feed (subscriptions feed), feed-marked
// (Veritasium's Videos tab), settings. Dark run, after the light one (it reads used.json so it
// shows other videos): dark-feed (subscriptions feed).
// The seed turns on two of the extension's own options, hiding the "Most relevant" shelf and
// Shorts, so the subscriptions feed is one continuous grid.
//
// PNGs are written at 2x device scale to tools/store/captures/ (override with STORE_CAPTURES),
// with meta.json holding each capture's size and the boxes the templates draw callouts around.
// Each video appears in one shot only, and no shot shows more than two videos of one channel.
// tools/store/render.mjs turns the captures into the store images. The feed is live: look at
// every PNG and run again if a shot caught a bad moment.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(process.env.STORE_CAPTURES || join(dirname(fileURLToPath(import.meta.url)), 'captures'));
const PREFIX = '#osasoft-better-subscriptions_';
const TOGGLE = PREFIX + 'hide-watched-toggle';
const ITEM = 'ytd-rich-grid-renderer #contents > ytd-rich-item-renderer';
// Videos left out of the store shots (taken off the page with a staging class, not by the
// extension): titles with emoji, titles that don't belong in an add-on listing,
// games/console/phone brands, and channels whose thumbnails are clickbait or angry faces.
const UNSUITABLE = /incel|loser|hate|kill|dead|death|dying|cancer|murder|nazi|war\b|humiliat|\baxe\b|trump|biden|politic|\*\*|gta|grand theft|xbox|playstation|ps5|nintendo|console|samsung|facebook|filth|\brage|knife|taser|weapon|\bgun\b|\p{Extended_Pictographic}/iu;
const EXCLUDED_CHANNELS = /New Rockstars|Internet Today/;
const H = 800; // default viewport height in CSS px
const FULL_W = 1152; // the hero: the whole page, logo to controls
const WIDE_W = 1280; // crops of the two right-hand columns: wide cards, no button overlap
const CHANNEL_W = Number(process.env.STORE_CHANNEL_W || 960); // the mark-watched close-up

// Privacy and clean-capture rules: no account avatar, notifications or country code; no
// scrollbars; no hover previews or inline players.
const STAGE_CSS = `
#avatar-btn, ytd-topbar-menu-button-renderer, ytd-notification-topbar-button-renderer,
#masthead #country-code, ytd-active-account-header-renderer { display: none !important; }
html { scrollbar-width: none !important; }
::-webkit-scrollbar { display: none !important; }
ytd-video-preview, #video-preview, #inline-preview-player { display: none !important; }
.store-staging-hidden, .store-skip { display: none !important; }
`;

// Crops that start mid-masthead: YouTube's search box would be cut, so it is taken out; the
// masthead is made opaque (it's translucent and the page shows through when scrolled).
const CROP_CSS = `
ytd-searchbox, yt-searchbox, #voice-search-button { display: none !important; }
#masthead-container, ytd-masthead, #masthead { background: #fff !important; backdrop-filter: none !important; }
html[dark] #masthead-container, html[dark] ytd-masthead, html[dark] #masthead { background: #0f0f0f !important; }
#masthead-container #background, ytd-masthead #background { opacity: 1 !important; }
`;

const used = new Set(); // video ids already shown in a shot of this run
const meta = existsSync(join(OUT, 'meta.json')) ? JSON.parse(readFileSync(join(OUT, 'meta.json'), 'utf8')) : {};

// 2x device scale through CDP: the harness context is 1x
async function setViewport(page, width, height) {
    if (!page._storeCdp) page._storeCdp = await page.context().newCDPSession(page);
    await page._storeCdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
    await page.waitForTimeout(1500);
}

async function parkMouse(page) {
    // over the masthead's empty middle: no card under it, so no hover preview
    await page.mouse.move(300, 28);
    await page.waitForTimeout(1500);
}

// visible grid cards: box, thumbnail box, video id, channel and the extension's buttons
async function cards(page) {
    return page.evaluate(item => [...document.querySelectorAll(item)]
        .filter(e => e.offsetParent !== null)
        .map(e => {
            const box = el => { const r = el?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; };
            const r = e.getBoundingClientRect();
            const t = (e.querySelector('ytd-thumbnail, yt-thumbnail-view-model, a#thumbnail') || e).getBoundingClientRect();
            const href = e.querySelector('a[href*="watch?v="]')?.getAttribute('href') || '';
            // by the first channel link's target (collab cards have no plain channel name text)
            const channel = e.querySelector('a[href^="/@"], a[href^="/channel/"]')?.getAttribute('href').split('/')[1] || '';
            return {
                x: r.x, y: r.y, right: r.right, bottom: r.bottom, thumbTop: t.y, thumbBottom: t.bottom,
                id: (/[?&]v=([\w-]{11})/.exec(href) || [])[1],
                channel,
                textLength: e.innerText.length,
                mark: box(e.querySelector('.subs-btn-mark-watched')),
                unmark: box(e.querySelector('.subs-btn-mark-unwatched')),
            };
        }), ITEM);
}

// grid rows (top to bottom), each a list of cards left to right
function rows(c) {
    const out = [];
    for (const k of c) {
        const row = out.find(r => Math.abs(r[0].y - k.y) < 2);
        if (row) row.push(k); else out.push([k]);
    }
    return out;
}

const pad = (b, p) => ({ x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p });

// clip is in viewport CSS pixels; the PNG comes out at 2x. Callouts are boxes in viewport CSS
// pixels with a label; they're stored relative to the clip for the templates to draw.
async function shot(page, name, clip, callouts = []) {
    const scroll = await page.evaluate(() => [window.scrollX, window.scrollY]);
    const c = { x: Math.round(clip.x), y: Math.round(clip.y), width: Math.round(clip.width), height: Math.round(clip.height) };
    const { data } = await page._storeCdp.send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: false,
        clip: { x: c.x + scroll[0], y: c.y + scroll[1], width: c.width, height: c.height, scale: 1 },
    });
    mkdirSync(OUT, { recursive: true });
    // STORE_SHOTS=a,b re-captures only those shots (the run still goes through all of them, so
    // the videos each one shows are left out of the later ones as usual)
    const only = process.env.STORE_SHOTS?.split(',');
    const keep = !only || only.includes(name);
    if (keep) writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
    const shown = [];
    for (const k of await cards(page)) {
        if (k.id && k.right > c.x && k.x < c.x + c.width && k.bottom > c.y && k.y < c.y + c.height) {
            used.add(k.id);
            shown.push(k.channel || '?');
        }
    }
    if (!keep) return;
    meta[name] = {
        width: c.width, height: c.height,
        callouts: callouts.map(o => ({ x: o.x - c.x, y: o.y - c.y, w: o.w, h: o.h, label: o.label, side: o.side || 'below' })),
    };
    writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
    console.log(`captured ${name}.png ${c.width}x${c.height} css px${shown.length ? ` (${shown.join(', ')})` : ''}`);
}

// idempotent: run again for cards YouTube loaded since, and after each shot (used videos)
async function stage(page) {
    if (!(await page.locator('#store-staging').count())) {
        await (await page.addStyleTag({ content: STAGE_CSS })).evaluate(e => { e.id = 'store-staging'; });
    }
    const left = await page.evaluate(({ item, re, channels, used }) => {
        const unsuitable = new RegExp(re, 'iu');
        const excluded = new RegExp(channels);
        const titles = [];
        for (const card of document.querySelectorAll(`${item}:not(.store-staging-hidden)`)) {
            const title = card.querySelector('#video-title, h3, a#video-title-link')?.textContent.trim() || '';
            const href = card.querySelector('a[href*="watch?v="]')?.getAttribute('href') || '';
            const id = (/[?&]v=([\w-]{11})/.exec(href) || [])[1];
            if (unsuitable.test(title) || excluded.test(card.innerText) || used.includes(id)) {
                card.classList.add('store-staging-hidden');
                if (!used.includes(id)) titles.push(title);
            }
        }
        return titles;
    }, { item: ITEM, re: UNSUITABLE.source, channels: EXCLUDED_CHANNELS.source, used: [...used] });
    for (const title of left) console.log(`left out: ${title}`);
    await page.waitForTimeout(500);
    await hideClipped(page);
    return left.length;
}

// Leaves out collab cards (avatar stack, "X and Y" channel line: a long metadata line) and any
// card whose text runs under the extension's eye/WATCHED button or past the card's edge: the
// button would sit on a date cut off mid-word. Depends on the watched state (the WATCHED button
// is wider), so it runs again after marking.
async function hideClipped(page) {
    for (let pass = 0; pass < 5; pass++) {
        const hidden = await page.evaluate(item => {
            const titles = [];
            for (const card of document.querySelectorAll(`${item}:not(.store-staging-hidden)`)) {
                if (card.offsetParent === null) continue;
                const title = card.querySelector('#video-title, h3')?.textContent.trim() || '';
                let clipped = Boolean(card.querySelector('yt-avatar-stack-view-model'));
                const btn = card.querySelector('.subs-btn-mark-watched, .subs-btn-mark-unwatched');
                const c = card.getBoundingClientRect();
                const b = btn?.getBoundingClientRect();
                const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
                while (!clipped && walker.nextNode()) {
                    const t = walker.currentNode;
                    if (!t.textContent.trim() || btn?.contains(t)) continue;
                    const range = document.createRange();
                    range.selectNodeContents(t);
                    for (const r of range.getClientRects()) {
                        if (!r.width) continue;
                        if (r.right > c.right + 1) clipped = true;
                        if (b && b.width && r.right > b.left + 1 && r.left < b.right - 1 && r.bottom > b.top + 1 && r.top < b.bottom - 1) clipped = true;
                    }
                }
                if (clipped) {
                    card.classList.add('store-staging-hidden');
                    titles.push(title);
                }
            }
            return titles;
        }, ITEM);
        for (const title of hidden) console.log(`left out (clipped): ${title}`);
        if (!hidden.length) return;
        await page.waitForTimeout(800); // the grid reflows
    }
}

// stage() until YouTube stops loading more cards (hiding many can pull in the next batch)
async function stageSettled(page) {
    let count = -1;
    for (let i = 0; i < 8; i++) {
        await stage(page);
        await page.waitForTimeout(1500);
        const now = await page.locator(ITEM).count();
        if (now === count) return;
        count = now;
    }
}

// For one shot: among the first `count` visible cards, skip (hide for now) any beyond `cap` per
// channel, so later cards move up. unskip() brings them back for the next shot.
// Rules are [count, cap] pairs, all applied: e.g. [[3, 1], [6, 2]] is one per channel in the
// first row of three and at most two in the first two rows.
async function diversify(page, rules) {
    for (let i = 0; i < 120; i++) {
        const all = await cards(page);
        let extra;
        for (const [count, cap] of rules) {
            const first = all.slice(0, count);
            const seen = {};
            const over = first.find(k => (seen[k.channel] = (seen[k.channel] || 0) + 1) > cap);
            // skip one of that channel's cards, but keep a card marked watched for the shot
            if (over) extra = first.filter(k => k.channel === over.channel && !k.unmark).pop() || over;
            if (extra) break;
        }
        if (!extra) return;
        await page.evaluate(({ item, id }) => document.querySelector(`${item}:has(a[href*="v=${id}"])`)?.classList.add('store-skip'),
            { item: ITEM, id: extra.id });
        await stage(page); // for any cards YouTube loaded as the grid got shorter
    }
}

async function unskip(page) {
    await page.evaluate(() => document.querySelectorAll('.store-skip').forEach(e => e.classList.remove('store-skip')));
}

async function setHideWatched(page, on) {
    const toggle = page.locator(TOGGLE).first();
    const checked = (await toggle.getAttribute('class')).includes('subs-btn-hide-watched-checked');
    if (checked !== on) {
        await toggle.click();
        await page.waitForTimeout(1000);
    }
}

// mark these cards watched with the extension's own button
async function markWatched(page, targets) {
    for (const id of targets.map(k => k.id)) {
        await page.locator(`${ITEM}:has(a[href*="v=${id}"]) .subs-btn-mark-watched`).first().click();
        await page.waitForTimeout(600);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
}

async function gridReady(page) {
    await page.locator('.subs-btn-mark-watched').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(2000);
}

// the union of the extension's masthead controls: label, toggle, mark all, settings
async function controlsBox(page) {
    return page.evaluate(prefix => {
        const rs = ['hide-watched-toggle-label', 'hide-watched-toggle', 'subs-grid-menu-mark-all', 'subs-grid-menu-settings']
            .map(id => document.getElementById(prefix + id)?.getBoundingClientRect()).filter(r => r && r.width);
        const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y));
        return { x, y, w: Math.max(...rs.map(r => r.right)) - x, h: Math.max(...rs.map(r => r.bottom)) - y };
    }, PREFIX.slice(1));
}

// The right part of the masthead (the extension's controls) over the first grid row, from the
// second column to the grid's right edge, ending `extra` px into the next row's thumbnails.
// The feed's header row is taken out so the cards sit under the masthead.
async function controlsCrop(page, name, { extra = 56, callouts = async () => [] } = {}) {
    const style = await page.addStyleTag({ content: CROP_CSS + 'ytd-rich-grid-renderer #contents > ytd-rich-section-renderer:first-child { display: none !important; }' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await parkMouse(page);
    const r = rows(await cards(page));
    const x = r[0][1].x - 12;
    const right = r[0][r[0].length - 1].right + 16;
    await shot(page, name, { x, y: 0, width: right - x, height: r[1][0].thumbTop + extra }, await callouts(r));
    await style.evaluate(e => e.remove());
}

// Marks cards watched until the first row's columns in `watched` show the WATCHED button and the
// others the eye, re-checking for clipped cards after each round (a marked card's WATCHED
// button is wider and can cover its text; that card is then left out and the row reflows).
async function arrangeRow(page, watched, columns) {
    for (let i = 0; i < 8; i++) {
        await hideClipped(page);
        const row = rows(await cards(page))[0];
        const want = columns.map(col => watched.includes(col));
        const toMark = columns.filter((col, j) => want[j] && row[col]?.mark).map(col => row[col]);
        const toUnmark = columns.filter((col, j) => !want[j] && row[col]?.unmark).map(col => row[col]);
        console.log(`arrangeRow: ${row.map(k => (k.unmark ? 'W' : k.mark ? 'e' : '?') + ':' + k.channel).join(' ')}`);
        if (!toMark.length && !toUnmark.length) return;
        await markWatched(page, toMark);
        for (const k of toUnmark) {
            await page.locator(`${ITEM}:has(a[href*="v=${k.id}"]) .subs-btn-mark-unwatched`).first().click();
            await page.waitForTimeout(600);
        }
    }
}

async function light(page) {
    // 1. hero, subscriptions feed with Hide watched on (the default): the whole page down to the
    //    second row's thumbnails, and a callout around the extension's controls
    await setViewport(page, FULL_W, H);
    await gridReady(page);
    await stageSettled(page);
    await diversify(page, [[6, 2]]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await parkMouse(page);
    let r = rows(await cards(page));
    const controls = pad(await controlsBox(page), 8);
    await shot(page, 'feed-hide', { x: 0, y: 0, width: FULL_W, height: r[1][0].thumbBottom + 6 },
        [{ ...controls, label: 'Watched videos: hidden' }]);
    await unskip(page);

    // 3. stop loading: the masthead (the extension's controls) right over the first row's two
    //    right-hand cards (the feed's header row is taken out), and below them a calm white
    //    strip with the floating button at the window's bottom right (the later rows are left
    //    out of this shot).
    await setViewport(page, WIDE_W, H);
    await stageSettled(page);
    await diversify(page, [[3, 1], [6, 2]]);
    const style = await page.addStyleTag({ content: CROP_CSS + `
        ytd-rich-grid-renderer #contents > ytd-rich-section-renderer:first-child { display: none !important; }
        .store-later-row { visibility: hidden !important; }
    ` });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    r = rows(await cards(page));
    await page.evaluate(({ item, top }) => {
        for (const card of document.querySelectorAll(item)) {
            if (card.getBoundingClientRect().y > top) card.classList.add('store-later-row');
        }
    }, { item: ITEM, top: r[0][0].bottom });
    const sv = Math.round(Math.max(...r[0].map(k => k.bottom)) + 84);
    await setViewport(page, WIDE_W, sv);
    await parkMouse(page);
    r = rows(await cards(page));
    const sx = r[0][1].x - 12;
    const btn = await page.evaluate(sel => document.querySelector(sel)?.getBoundingClientRect().toJSON(), PREFIX + 'stop-loading-older');
    await shot(page, 'feed-stop', { x: sx, y: 0, width: r[0][2].right + 16 - sx, height: sv },
        [{ ...pad({ x: btn.x, y: btn.y, w: btn.width, h: btn.height }, 6), label: 'Stops endless loading', side: 'left' }]);
    await page.evaluate(() => document.querySelectorAll('.store-later-row').forEach(e => e.classList.remove('store-later-row')));
    await style.evaluate(e => e.remove());
    await unskip(page);

    // marquee: the extension's controls with Hide watched off, over two cards of different
    //    channels: a faded watched one (WATCHED button) and an unwatched one (eye)
    await setViewport(page, WIDE_W, H);
    await setHideWatched(page, false);
    await stageSettled(page);
    await diversify(page, [[3, 1], [6, 2]]);
    await arrangeRow(page, [1], [1, 2]);
    await diversify(page, [[3, 1], [6, 2]]);
    // ends before the next row's thumbnails: at marquee size they're just clutter (and logos)
    await controlsCrop(page, 'marquee-feed', { extra: -8 });
    await unskip(page);
    await setHideWatched(page, true);

    // 2. mark watched, on a calm channel's Videos tab (same controls): Hide watched off, cards
    //    marked, callouts on both kinds of button. Close up, so the buttons are large: one
    //    complete row of three narrow cards (YouTube's 3-per-row layout, forced at this width)
    //    and the next row's thumbnails, with extra space between the rows for the labels.
    await page.goto('https://www.youtube.com/@veritasium/videos', { waitUntil: 'domcontentloaded' });
    await setViewport(page, CHANNEL_W, H);
    await gridReady(page);
    // YouTube marks each row's first card for its own 2-per-row layout here; even margins so the
    // forced rows line up
    await page.addStyleTag({ content: `
        ytd-rich-grid-renderer { --ytd-rich-grid-items-per-row: 3 !important; }
        ytd-rich-grid-renderer #contents > ytd-rich-item-renderer { margin-left: 8px !important; margin-right: 8px !important; margin-bottom: 52px !important; }
    ` });
    await stageSettled(page);
    await setHideWatched(page, false);
    // the first two cards of the first row (the third, by the frame's edge, stays unwatched),
    // then two in the second row, which only shows thumbnails
    await arrangeRow(page, [0, 1], [0, 1, 2]);
    r = rows(await cards(page));
    await markWatched(page, [r[1][1], r[1][2]].filter(k => k?.mark));
    // the first row well below the masthead and the channel's sticky tab bar
    r = rows(await cards(page));
    await page.evaluate(y => window.scrollBy(0, y), r[0][0].y - 300);
    await page.waitForTimeout(2500); // let the grid settle after the reflow
    await parkMouse(page);
    r = rows(await cards(page)).filter(k => k[0].y > 200);
    const mx = r[0][0].x - 12;
    const my = r[0][0].y - 12;
    await shot(page, 'feed-marked', {
        // ends just below the second row's thumbnails, before their titles
        x: mx, y: my, width: r[0][r[0].length - 1].right + 12 - mx, height: r[1][0].thumbBottom + 10 - my,
    }, [
        { ...pad(r[0].find(k => k.mark).mark, 6), label: 'Mark watched', side: 'below' },
        { ...pad(r[0].find(k => k.unmark).unmark, 6), label: 'Undo with one click', side: 'below' },
    ]);

    // the dark run continues with videos not used here; written before the settings shot so a
    // failure there can't leave a stale list behind
    writeFileSync(join(OUT, 'used.json'), JSON.stringify([...used], null, 2) + '\n');

    // 4. settings page, light
    await settings(page, 'settings');
}

// 5. dark theme, subscriptions feed with videos the light run didn't show: Hide watched off,
//    one card marked, the controls over two cards of different channels
async function dark(page) {
    if (existsSync(join(OUT, 'used.json'))) {
        for (const id of JSON.parse(readFileSync(join(OUT, 'used.json'), 'utf8'))) used.add(id);
    }
    await setViewport(page, WIDE_W, H);
    await gridReady(page);
    await setHideWatched(page, false);
    await stageSettled(page);
    // with the light run's videos left out, load more of the feed so other channels are in reach
    for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 4000);
        await page.waitForTimeout(1500);
    }
    await stageSettled(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await diversify(page, [[3, 1], [6, 2]]);
    await arrangeRow(page, [2], [1, 2]);
    await diversify(page, [[3, 1], [6, 2]]);
    await page.waitForTimeout(1500);
    // the extension's fade on watched cards (.semitransparent, opacity .5), for the report
    console.log('dark: watched card opacity', await page.evaluate(() => [...document.querySelectorAll('.semitransparent')]
        .filter(e => e.offsetParent !== null).slice(0, 3).map(e => getComputedStyle(e).opacity).join(', ')));
    await controlsCrop(page, 'dark-feed', {
        callouts: async () => [{ ...pad(await controlsBox(page), 8), label: 'Hide watched: off', side: 'left' }],
    });
}

// Settings page (follows prefers-color-scheme): the rows from Hide Shorts to Hide members-only,
// with Shorts and members-only switched on; no divider lines at the crop's edges.
async function settings(page, name) {
    // the MV3 service worker may have gone idle by now: wait for it like harness.mjs does
    let [worker] = page.context().serviceWorkers();
    if (!worker) worker = await page.context().waitForEvent('serviceworker', { timeout: 10000 });
    const id = worker.url().split('/')[2];
    const sp = await page.context().newPage();
    await setViewport(sp, 760, 900);
    await sp.goto(`chrome-extension://${id}/pages/settings/settings.html`);
    await sp.locator('.settings-list:not(.hidden)').first().waitFor({ timeout: 15000 });
    for (const key of ['settings.hide.shorts', 'settings.hide.members.only']) {
        const box = sp.locator(`[id="${key}"]`);
        if (!(await box.isChecked())) await box.locator('xpath=..').click();
    }
    await sp.addStyleTag({ content: 'html { scrollbar-width: none !important; }' });
    await sp.evaluate(() => document.activeElement?.blur());
    await sp.mouse.move(2, 2);
    await sp.waitForTimeout(1200);
    const top = sp.locator('.setting-item:has([id="settings.hide.shorts"])');
    const bottom = sp.locator('.setting-item:has([id="settings.hide.members.only"])');
    await top.scrollIntoViewIfNeeded();
    await sp.evaluate(() => window.scrollBy(0, -40));
    const card = await sp.locator('#settings-subscriptions').boundingBox();
    const t = await top.boundingBox();
    const b = await bottom.boundingBox();
    const toggle = await top.locator('.toggle').boundingBox();
    await shot(sp, name, { x: card.x, y: t.y + 1, width: card.width, height: b.y + b.height - 2 - (t.y + 1) },
        [{ ...pad({ x: toggle.x, y: toggle.y, w: toggle.width, h: toggle.height }, 6), label: 'Shorts: hidden', side: 'left' }]);
    await sp.close();
}

export default async function (page, { theme }) {
    if (theme === 'dark') await dark(page);
    else await light(page);
}
