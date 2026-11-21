# Store listing images

Generated files: don't edit them by hand. They're excluded from the release ZIP.

| File | Size | Chrome Web Store | Firefox Add-ons |
|---|---|---|---|
| `screenshot-1-hide-watched.png` | 1280x800 | Screenshot 1 | Screenshot 1 |
| `screenshot-2-mark-watched.png` | 1280x800 | Screenshot 2 | Screenshot 2 |
| `screenshot-3-stop-loading.png` | 1280x800 | Screenshot 3 | Screenshot 3 |
| `screenshot-4-settings.png` | 1280x800 | Screenshot 4 | Screenshot 4 |
| `screenshot-5-dark-theme.png` | 1280x800 | Screenshot 5 | Screenshot 5 |
| `promo-small-440x280.png` | 440x280 | Small promo tile | (not used) |
| `promo-marquee-1400x560.png` | 1400x560 | Marquee promo tile | (not used) |

The Chrome Web Store takes up to 5 screenshots (1280x800 or 640x400). It also takes a 440x280 small promo tile and a 1400x560 marquee. Firefox Add-ons only takes screenshots, so upload the same five there. All files are PNGs with no alpha channel.

## Regenerating

1. Capture fresh screenshots of YouTube with the extension loaded. This uses the visual harness, signed in to the test account (see `CLAUDE.md`). Run it from the repo root, or pass `--ext` with a worktree path:

   ```sh
   node tools/visual/harness.mjs record --ext . --seed tools/store/seed.json --actions tools/store/capture.mjs --out pr-media/store --seconds 1
   node tools/visual/harness.mjs record --ext . --seed tools/store/seed.json --actions tools/store/capture.mjs --out pr-media/store --seconds 1 --theme dark
   ```

   These write 2x PNGs and `meta.json` (the callout boxes) to `tools/store/captures/`. Sources:
   - The hero, stop-loading and marquee shots come from the subscriptions feed.
   - The mark-watched close-up comes from Veritasium's Videos tab.
   - The dark shot comes from the subscriptions feed too. Run it after the light run: it reads `used.json` from that run so it shows other videos.

   Channel pages get the same controls as the feed. The seed switches on two of the extension's own options, hiding the "Most relevant" shelf and Shorts, so the feed is one grid.

   The feed is live, so look at every capture and run again if one caught a bad moment. To redo only some shots, set `STORE_SHOTS` (for example `STORE_SHOTS=feed-marked,marquee-feed`); the run still goes through every shot so the others' videos stay out of them, but only writes those. Some videos are left out of the shots by the staging rules in `capture.mjs`: titles matching `UNSUITABLE`, channels matching `EXCLUDED_CHANNELS`, and any video already shown in an earlier shot. Within one shot, videos beyond two per channel (one per channel in a two-card crop) are skipped. The script prints each title it leaves out.

2. Render the store images. This needs no sign-in or extension, but it needs network access for the Inter font, and Playwright's Chromium (`npx playwright install chromium` once on a fresh clone):

   ```sh
   node tools/store/render.mjs
   ```

   Captions and taglines are in `tools/store/render.mjs`. The design is in `tools/store/templates/`, with the shared look in `store.css` and the capture framing and callouts in `frame.js`. The render fails if a caption has more than 8 words, if text overflows, if the font doesn't load, or if an output has the wrong size or an alpha channel.
