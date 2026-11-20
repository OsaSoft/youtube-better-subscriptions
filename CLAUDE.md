# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTube Better Subscriptions is a browser extension (Chrome/Firefox) that improves YouTube's subscription feed by allowing users to hide watched videos, mark videos as watched/unwatched, and manage their subscription experience.

## Development

**No build system** - This is a vanilla JavaScript browser extension. Changes take effect immediately when reloading the extension in the browser.

**To test locally:**
1. Chrome: Go to `chrome://extensions/`, enable Developer mode, click "Load unpacked", select the project directory
2. Firefox: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", select `manifest.json`

**Code style:**
- 4-space indentation for JavaScript and XML files
- 2-space indentation for other files
- UTF-8 charset, LF line endings (enforced via `.editorconfig`)

**Tests:** `npx jest` (unit tests in `tests/`). UI behaviour is checked with recordings from the visual harness (below), and Firefox is still tested by hand.

## Visual harness (recording YouTube with the extension)

`tools/visual/harness.mjs` drives Playwright's Chromium with the unpacked extension loaded, signed in to a dedicated test YouTube account.

- **Profile:** `~/.local/share/ybs-harness/profile` (override with `YBS_PROFILE`), outside the repo, owner-only permissions. It holds the test account's session cookies: never commit, copy into the repo, or upload it. Each recording runs on a throwaway copy, so extension storage starts empty unless seeded.
- **Sign in (once, or when the session expires):** `node tools/visual/harness.mjs login` opens a plain Chromium window; the user signs in and closes it. Agents can't do this step. If `record` prints "not signed in", ask the user to run it.
- **Record:** `node tools/visual/harness.mjs record --out pr-media/<slug>/<feature>/<what>-before --ext <worktree> [--theme dark] [--actions steps.mjs] [--seed storage.json] [--url …] [--seconds N]`.
  - `--ext` picks the build: the `master` worktree for "before", the fix's worktree for "after".
  - `--actions` is a module whose default export is `async (page, { theme }) => {}` with the clicks for the clip; see `tools/visual/examples/hide-watched.mjs`. Extension elements have ids prefixed with `osasoft-better-subscriptions_`.
  - `--seed` is JSON `{ "local": {...}, "sync": {...} }` written to extension storage before the page loads.
  - The theme is forced through YouTube's `PREF` cookie; the UI is English (`en-US`).
  - Output: `recording-<theme>.webm` and `final-<theme>.png`. Get frames for the scorer with `ffmpeg -i recording-light.webm -vf fps=1 frame-%02d.png`.
- **The feed is live.** Videos change between runs, so record before and after back to back and judge the extension's behaviour, not the videos. Hiding watched videos is on by default (`settings.hide.watched.default`).
- **Linux quirks:** Playwright's Chromium is required (Chrome 137+ ignores `--load-extension`). It runs without the sandbox because Ubuntu's AppArmor blocks it for downloaded browsers, and with `--password-store=basic` so cookies saved by `login` can be read by `record`.

## Feature workflow

1. **Acceptance criteria first.** Number what a person should *see* when it works: per page (subscriptions feed, home, channel, watch page) and in both themes if colours or extension UI change. The scorer judges against them and the PR lists them. Save them in `.local/<slug>/criteria.md`.
2. **Record "before"** on `master` with the harness, from a separate worktree.
3. **Implement:** one Opus subagent in its own worktree, briefed with `tools/visual/brief-common.md` plus the criteria. For big or risky changes, run 2–3 independent approaches and keep the one that scores best.
4. **Verify by evidence:** `npx jest` passes, then record "after". Record light **and** dark only when the change affects appearance. A scorer agent that never saw the code grades the frames against the criteria using `tools/visual/scorer-prompt.md`. Iterate until it scores ≥ 9/10.
   - **Screenshots or video:** for static visual changes (colours, contrast, theming, styling), before/after screenshots per theme are enough, for the scorer and the PR; take them with `page.screenshot` at each state in an `--actions` script. Record video only for behaviour over time (clicks, loading, navigation, animation, timing).
5. **Independent review** by a fresh agent that gets only the diff, not the implementer's conclusions. Fix the real findings.
6. **Clean history:** replay into a few logical commits (prerequisite fixes, then the change, then tests and docs) and check `git diff <tested-sha> HEAD` is empty.
7. **PR:** `gh pr create --body-file body.md --attach <clip>` with sections Problem / Acceptance criteria (each with its scorer result, plus the score history, e.g. 8/10 → 9/10) / Change / Verification / Not checked / Already broken on `master` / Videos or Screenshots (labelled **Before**/**After**, and **Light**/**Dark** when both were recorded). Put each one on its own line as `![](pr-media/…/clip.mp4)` or `![](pr-media/…/shot.png)` and check afterwards with `gh pr view <N> --json body` that no local `pr-media/` path is left. Media lives in the gitignored `pr-media/`.
8. **The user merges** by saying "merge" (squash), then remove the worktrees and branches.

## Architecture

### Content Script Loading Order (manifest.json)

Scripts load sequentially on YouTube pages:
1. `util.js` - Logging utilities
2. `common.js` - Storage management, settings definitions, watched videos tracking
3. `settingsLoader.js` - Async settings loader with callbacks
4. `queries.js` - CSS selectors for YouTube DOM elements
5. `videos/Video.js` - Base Video class
6. `videos/SubscriptionsVideo.js` - Subscription feed video class
7. `subs-ui.js` - UI building (buttons, overlays)
8. `subs.js` - Main subscription feed handler
9. `vid.js` - Video watch page handlers
10. `pageHandler.js` - Page routing and initialization

### Key Components

**Storage (common.js):**
- Uses `browser.storage.sync` for cloud sync (batched in 100KB chunks)
- Uses `browser.storage.local` for local caching
- Watched videos stored as operations: `'w' + videoId` (watched) or `'n' + videoId` (unwatched)
- Throttles sync operations (1000ms)

**Page Routing (pageHandler.js):**
Handles different YouTube pages: `/feed/subscriptions`, `/watch`, `/shorts`, homepage, channel pages

**DOM Selectors (queries.js):**
Centralized CSS selectors for YouTube elements. These break frequently when YouTube updates their layout.

**Video Classes (videos/):**
- `Video.js` - Base class with videoId, isStored, isPremiere, isShort properties
- `SubscriptionsVideo.js` - Extends Video with subscription-specific UI (mark watched/unwatched buttons)

### Important Patterns

- **MutationObserver** in `subs.js` and `pageHandler.js` for detecting page changes
- **Periodic polling** via `setInterval` for DOM scanning and refresh
- **Global state** for settings and watched videos lists

## YouTube Layout Updates

YouTube frequently changes their DOM structure. When videos stop being detected or UI breaks:
1. Inspect YouTube's DOM structure in browser DevTools
2. Update selectors in `queries.js` (centralized queries) and `subs.js` (inline selectors)
3. Check Video class property extraction in `videos/Video.js` and `videos/SubscriptionsVideo.js`

## Release Process

Releases are automated via GitHub Actions (`.github/workflows/release.yml`):
- Triggered by git tags matching `v*`
- Creates ZIP archive and GitHub release
- Validates manifest.json schema
