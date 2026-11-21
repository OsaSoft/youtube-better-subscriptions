#!/usr/bin/env node
// Replaces the Firefox Add-ons (AMO) listing screenshots with store-assets/screenshot-*.png.
// Run by .github/workflows/store-listing.yml; needs WEB_EXT_API_KEY and WEB_EXT_API_SECRET.
//
//   node tools/store/amo-previews.mjs           list the current previews only
//   node tools/store/amo-previews.mjs --apply   upload the new ones, then delete the old ones
//
// The old previews are deleted only after every new one is uploaded and captioned, so a failure
// leaves the listing with extra screenshots rather than none.

import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GUID = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')).browser_specific_settings.gecko.id;
const API = `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(GUID)}`;
const SHOTS = [
    ['screenshot-1-hide-watched.png', "Hide videos you've already watched"],
    ['screenshot-2-mark-watched.png', 'Mark videos watched with one click'],
    ['screenshot-3-stop-loading.png', 'Stop loading years of old videos'],
    ['screenshot-4-settings.png', 'Choose exactly what to hide'],
    ['screenshot-5-dark-theme.png', 'Looks right in dark mode too'],
];

// a fresh token per request: AMO rejects tokens that live longer than five minutes
function auth() {
    const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = b64({ alg: 'HS256', typ: 'JWT' }) + '.' +
        b64({ iss: process.env.WEB_EXT_API_KEY, jti: crypto.randomUUID(), iat: now, exp: now + 60 });
    const sig = crypto.createHmac('sha256', process.env.WEB_EXT_API_SECRET).update(unsigned).digest('base64url');
    return { Authorization: `JWT ${unsigned}.${sig}` };
}

async function call(method, path, { json, form } = {}) {
    const headers = auth();
    let body;
    if (json) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(json);
    } else if (form) {
        body = form;
    }
    const res = await fetch(API + path, { method, headers, body });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} returned HTTP ${res.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : null;
}

function describe(p) {
    const caption = p.caption ? Object.values(p.caption)[0] : '';
    return `#${p.id} pos ${p.position ?? '?'} ${p.image_size?.join('x') || ''} ${caption}`;
}

if (!process.env.WEB_EXT_API_KEY || !process.env.WEB_EXT_API_SECRET) {
    console.error('WEB_EXT_API_KEY and WEB_EXT_API_SECRET must be set');
    process.exit(1);
}

const addon = await call('GET', '/');
const old = addon.previews || [];
console.log(`Current previews (${old.length}):`);
old.forEach(p => console.log('  ' + describe(p)));

if (!process.argv.includes('--apply')) {
    console.log('Dry run: nothing changed. Pass --apply to replace them.');
    process.exit(0);
}

for (const [i, [file, caption]] of SHOTS.entries()) {
    const form = new FormData();
    form.append('image', new Blob([readFileSync(join(ROOT, 'store-assets', file))], { type: 'image/png' }), file);
    const created = await call('POST', '/previews/', { form });
    // caption and position are set separately: AMO doesn't take a caption on upload
    const edited = await call('PATCH', `/previews/${created.id}/`, { json: { caption: { 'en-US': caption }, position: i + 1 } });
    console.log('Uploaded ' + describe(edited));
}
for (const p of old) {
    await call('DELETE', `/previews/${p.id}/`);
    console.log(`Deleted old preview #${p.id}`);
}
const after = (await call('GET', '/')).previews || [];
console.log(`Previews now (${after.length}):`);
after.forEach(p => console.log('  ' + describe(p)));
