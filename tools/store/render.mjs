#!/usr/bin/env node
// Renders the store listing images from tools/store/templates/ and the raw captures in
// tools/store/captures/ (made by tools/store/capture.mjs through the visual harness; meta.json
// there holds each capture's callout boxes) into store-assets/. No extension or YouTube sign-in
// needed; fonts come from Google Fonts.
//
//   node tools/store/render.mjs
//
// Needs ffmpeg on PATH only if Chromium hands back a PNG with an alpha channel (the stores want
// none): it is then re-encoded as RGB.

import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../../store-assets');
const META = JSON.parse(readFileSync(join(HERE, 'captures/meta.json'), 'utf8'));
const TAGLINE = "Hide or mark what you've watched";
const LIGHT = '#ffffff';
const DARK = '#0f0f0f';

// a screenshot from capture `name` (templates/screenshot.html), with its callouts from meta.json
function shot(out, caption, name, bg) {
    return {
        out, template: 'screenshot.html', size: [1280, 800],
        params: {
            caption, img: `../captures/${name}.png`, bg, dark: bg === DARK ? '1' : '0',
            callouts: JSON.stringify(META[name]?.callouts || []),
        },
    };
}

const JOBS = [
    shot('screenshot-1-hide-watched.png', "Hide videos you've already watched", 'feed-hide', LIGHT),
    shot('screenshot-2-mark-watched.png', 'Mark videos watched with one click', 'feed-marked', LIGHT),
    shot('screenshot-3-stop-loading.png', 'Stop loading years of old videos', 'feed-stop', LIGHT),
    shot('screenshot-4-settings.png', 'Choose exactly what to hide', 'settings', LIGHT),
    shot('screenshot-5-dark-theme.png', 'Looks right in dark mode too', 'dark-feed', DARK),
    { out: 'promo-small-440x280.png', template: 'tile-small.html', size: [440, 280], params: { tagline: TAGLINE } },
    { out: 'promo-marquee-1400x560.png', template: 'marquee.html', size: [1400, 560],
        params: { tagline: TAGLINE, img: '../captures/marquee-feed.png', bg: LIGHT } },
];

const MAX_CAPTION_WORDS = 8;

// width, height and colour type from the IHDR chunk
function pngInfo(buf) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}

function dropAlpha(buf) {
    const res = spawnSync('ffmpeg', ['-v', 'error', '-f', 'png_pipe', '-i', '-', '-pix_fmt', 'rgb24', '-f', 'image2pipe', '-vcodec', 'png', '-'],
        { input: buf, maxBuffer: 64 * 1024 * 1024 });
    if (res.status !== 0) throw new Error(`ffmpeg could not drop the alpha channel: ${res.stderr || res.error}`);
    return res.stdout;
}

async function launch() {
    try {
        return await chromium.launch();
    } catch {
        return chromium.launch({ channel: 'chromium' });
    }
}

// Every image is rendered and checked before any is written, so a failure leaves store-assets/ as it was
const rendered = [];
const browser = await launch();
try {
    for (const job of JOBS) {
        if (job.params.caption && job.params.caption.split(/\s+/).length > MAX_CAPTION_WORDS) {
            throw new Error(`${job.out}: caption longer than ${MAX_CAPTION_WORDS} words`);
        }
        const [width, height] = job.size;
        const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
        const url = pathToFileURL(join(HERE, 'templates', job.template));
        url.search = new URLSearchParams(job.params).toString();
        await page.goto(url.href, { waitUntil: 'networkidle' });
        const problem = await page.evaluate(async () => {
            await window.ready;
            for (const img of document.images) {
                if (!img.complete) await new Promise(r => { img.onload = img.onerror = r; });
                if (!img.naturalWidth) return `image did not load: ${img.src}`;
            }
            // fonts.check() is also true when no Inter face is registered at all (stylesheet failed
            // to load), so look for a loaded Inter face instead
            await document.fonts.load('800 40px Inter');
            if (![...document.fonts].some(f => f.family.replace(/["']/g, '') === 'Inter' && f.status === 'loaded')) {
                return 'Inter did not load (offline?)';
            }
            const overflow = [...document.querySelectorAll('h1, p, .callout-label')]
                .find(e => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > innerWidth);
            return overflow ? `text overflows: ${overflow.textContent.trim()}` : null;
        });
        if (problem) throw new Error(`${job.out}: ${problem}`);
        let png = await page.screenshot({ type: 'png' });
        await page.close();
        if (pngInfo(png).colorType !== 2) png = dropAlpha(png);
        const info = pngInfo(png);
        if (info.width !== width || info.height !== height || info.colorType !== 2) {
            throw new Error(`${job.out}: got ${info.width}x${info.height} colour type ${info.colorType}`);
        }
        rendered.push([job.out, png, info]);
    }
} finally {
    await browser.close();
}
mkdirSync(OUT, { recursive: true });
for (const [name, png, info] of rendered) {
    writeFileSync(join(OUT, name), png);
    console.log(`${name}  ${info.width}x${info.height}  RGB`);
}
