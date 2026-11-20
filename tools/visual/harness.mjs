#!/usr/bin/env node
// Visual harness: drive YouTube with the unpacked extension loaded, for before/after recordings.
//
//   node tools/visual/harness.mjs login
//       Opens a plain (non-automated) Chromium window on the harness profile so you can sign in
//       to the test YouTube account once. Close the window when done; cookies stay in the profile.
//
//   node tools/visual/harness.mjs record --out <dir> [--ext <path>] [--url <url>] [--seconds N]
//                                        [--theme light|dark] [--seed <storage.json>] [--headed]
//                                        [--actions <steps.mjs>] [--init-script <file.js>]
//       Launches Chromium with the extension from --ext (default: repo root; pass a worktree
//       path to record another build), opens --url (default: subscriptions feed), records a
//       video plus a screenshot at the end into --out. --actions runs a script of clicks first.
//
// The profile lives outside the repo (YBS_PROFILE, default ~/.local/share/ybs-harness/profile)
// because it holds the test account's session cookies. Never commit or share it.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, cpSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = process.env.YBS_PROFILE || join(homedir(), '.local/share/ybs-harness/profile');

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const next = argv[i + 1];
            if (next === undefined || next.startsWith('--')) args[key] = true;
            else { args[key] = next; i++; }
        } else args._.push(a);
    }
    return args;
}

async function login() {
    mkdirSync(PROFILE, { recursive: true, mode: 0o700 });
    // Plain binary, no CDP/automation flags: Google refuses sign-in from automated browsers.
    const child = spawn(chromium.executablePath(), [
        `--user-data-dir=${PROFILE}`,
        '--no-first-run',
        // Match what Playwright passes, so the cookies written here can be read by `record`:
        // no sandbox (Ubuntu's AppArmor blocks it for downloaded Chromium) and basic cookie
        // encryption instead of the desktop keyring.
        '--no-sandbox',
        '--password-store=basic',
        '--use-mock-keychain',
        'https://accounts.google.com/ServiceLogin?continue=https://www.youtube.com/feed/subscriptions',
    ], { stdio: 'inherit' });
    console.log(`Sign in, then close the window. Profile: ${PROFILE}`);
    await new Promise(r => child.on('exit', r));
}

async function record(args) {
    if (!args.out) throw new Error('--out <dir> is required');
    const out = resolve(args.out);
    const ext = resolve(args.ext || REPO);
    const url = args.url || 'https://www.youtube.com/feed/subscriptions';
    const seconds = Number(args.seconds || 15);
    const theme = args.theme === 'dark' ? 'dark' : 'light';
    mkdirSync(out, { recursive: true });

    // Work on a throwaway copy so runs don't pollute each other (extension storage, cache),
    // while still carrying the signed-in cookies.
    const runProfile = join(dirname(PROFILE), `run-${process.pid}`);
    const videoDir = join(out, '.video-tmp');
    let ctx, page;
    try {
        rmSync(runProfile, { recursive: true, force: true });
        cpSync(PROFILE, runProfile, { recursive: true, filter: src => !/Singleton/.test(src) });
        ctx = await chromium.launchPersistentContext(runProfile, {
            channel: 'chromium', // full Chromium: extensions don't load in the headless shell
            headless: !args.headed,
            viewport: { width: 1600, height: 1000 },
            colorScheme: theme,
            locale: 'en-US', // stable English UI text for the scorer
            recordVideo: { dir: videoDir, size: { width: 1600, height: 1000 } },
            args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
        });
        let [worker] = ctx.serviceWorkers();
        if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 10000 });
        console.log(`Extension loaded: ${worker.url().split('/')[2]}`);

        if (args.seed) {
            const seed = JSON.parse(readFileSync(resolve(args.seed), 'utf8'));
            await worker.evaluate(async s => {
                await chrome.storage.local.clear();
                await chrome.storage.sync.clear();
                if (s.local) await chrome.storage.local.set(s.local);
                if (s.sync) await chrome.storage.sync.set(s.sync);
            }, seed);
        }

        // Force YouTube's theme through the PREF cookie: f6 is a hex bitfield where
        // 0x400 = dark and 0x80000 = light. Otherwise the account's saved appearance wins.
        const [pref] = (await ctx.cookies('https://www.youtube.com')).filter(c => c.name === 'PREF');
        const params = new URLSearchParams(pref?.value || '');
        const f6 = (parseInt(params.get('f6') || '0', 16) & ~0x400 & ~0x80000) | (theme === 'dark' ? 0x400 : 0x80000);
        params.set('f6', f6.toString(16));
        await ctx.addCookies([{
            name: 'PREF', value: decodeURIComponent(params.toString()), domain: '.youtube.com', path: '/',
            expires: Math.floor(Date.now() / 1000) + 3600 * 24 * 365, secure: true, sameSite: 'Lax',
        }]);

        if (args['init-script']) {
            // Runs in every page before YouTube's own scripts: for measurements that must see the load.
            await ctx.addInitScript({ path: resolve(args['init-script']) });
        }

        page = ctx.pages()[0] || await ctx.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('ytd-masthead #end', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);
        const signInButtons = await page.locator('ytd-masthead a[href*="ServiceLogin"]').count();
        if (signInButtons > 0) console.warn('WARNING: not signed in to YouTube; run `login` first.');

        if (args.actions) {
            // A module whose default export is `async (page, { theme }) => {}`: the clicks for this clip.
            const { default: actions } = await import(pathToFileURL(resolve(args.actions)).href);
            await actions(page, { theme });
            // Park the mouse so YouTube's hover previews don't play in the final frames.
            await page.mouse.move(5, 500);
        }
        await page.waitForTimeout(seconds * 1000);
        await page.screenshot({ path: join(out, `final-${theme}.png`) });
    } finally {
        // The run copy holds session cookies: always remove it, even if the launch failed.
        // Keep this page's video specifically: the extension opens its changelog tab on install.
        const videoPath = await page?.video()?.path().catch(() => null);
        await ctx?.close();
        if (videoPath) renameSync(videoPath, join(out, `recording-${theme}.webm`));
        rmSync(videoDir, { recursive: true, force: true });
        rmSync(runProfile, { recursive: true, force: true });
    }
    console.log(`Saved to ${out}`);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (cmd === 'login') await login();
else if (cmd === 'record') await record(args);
else {
    console.error('Usage: harness.mjs login | record --out <dir> [--ext <path>] [--url <url>] [--seconds N] [--theme light|dark] [--seed file] [--actions steps.mjs] [--init-script file.js] [--headed]');
    process.exit(1);
}
