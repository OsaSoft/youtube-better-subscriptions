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

**No automated tests** - Testing is manual across browsers.

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
