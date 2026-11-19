## How to work
- You're in your own git worktree of Better Subscriptions for YouTube (vanilla JS browser extension, no build step), based on `master` @ `{{BASE_SHA}}`. Read `CLAUDE.md` at the repo root first and follow it.
- Keep the diff tight to your own hunks. Don't refactor or reformat surrounding code.
- **Do not run the visual harness or open a browser**; the coordinator records. You may read `tools/visual/` to understand how clips are made.
- Run `npm install` if `node_modules` is missing, then `npx jest`. Report the test count before and after.
- New behaviour gets a Jest test where the logic is testable outside the DOM (see `tests/`).
- Branch `{{BRANCH}}`. Conventional commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; never a claude.ai session link. Commit your work; don't push, don't open a PR.

## Report back
- Branch, final SHA, worktree path, test count (before/after).
- What a user sees now, per criterion, and which criteria you think are at risk.
- Selectors you relied on that YouTube might change.
- Anything already broken on `master` you noticed (don't fix it unless it's in scope).
