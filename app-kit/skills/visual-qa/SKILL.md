---
description: Screenshot an app-kit app's main routes (desktop + mobile, light + dark), run axe-core contrast and accessibility checks, score the design against a rubric, and fix what fails before the code is committed. Runs as step 1c of /new-app; also use it on any existing app-kit app after UI changes.
---

# /app-kit:visual-qa — look at the app before anyone else does

`npm run build` passing says nothing about whether the app *looks* right. Generated UIs commonly ship with low-contrast text, thin fonts on colored badges, mobile overflow, a dark mode nobody checked, or one page styled differently from the rest. This skill catches those before the first commit.

Run it from the app's root directory.

## 1. Install the shared tooling (once per machine)

The screenshot tooling lives outside the app so it never lands in the app's `package.json`:

```bash
QA=~/.cache/mesh44/visual-qa
mkdir -p "$QA"
cp <plugin>/templates/visual-qa/shoot.mjs <plugin>/templates/visual-qa/package.json "$QA/"
(cd "$QA" && npm install --no-audit --no-fund && npx playwright install chromium)
```

Re-copy `shoot.mjs` if the plugin version changed. If `npx playwright install chromium` can't download, point `APP_KIT_CHROME` at an existing Chrome/Chromium binary instead (on macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).

## 2. Serve the production build

Test the production build, not the dev server — that's what ships, and some bugs (like Cognito's `global is not defined`) only appear there.

- **Vite:** `npm run build && (npx vite preview --port 4173 --strictPort &)`
- **Next.js:** `npm run build && (npx serve out -l 4173 &)`

Wait until `curl -sf http://localhost:4173 >/dev/null` succeeds. Stop the server when you're done.

## 3. Pick the routes

Up to 5 routes that show the app's range. Read the router (`src/App.tsx` / `src/main.tsx` for Vite, `out/**/*.html` for Next.js). Always include `/`. If Cognito is on, the signed-in routes redirect to the login card — shoot `/` (the login card) and leave signed-in pages for a manual check, unless the user gives you a test account.

## 4. Shoot

```bash
mkdir -p .app-kit/qa
node ~/.cache/mesh44/visual-qa/shoot.mjs --base http://localhost:4173 --out .app-kit/qa --routes / /<route2> /<route3>
```

This writes `<route>-<desktop|mobile>-<light|dark>.png` plus `report.json`, and prints a summary: serious/critical axe violations (including `color-contrast`), mobile horizontal overflow, and console errors per shot. `.app-kit/` is gitignored.

## 5. Judge

**Hard gates (must be zero, fix before continuing):**
- `contrastFailures` and any other `serious` / `critical` axe violation
- `overflowShots` (horizontal scroll on mobile)
- `consoleErrorShots` and shot `errors` (blank pages, runtime errors)

**Design rubric (Read every PNG, score each 1–5):**

| Criterion | What a 5 looks like |
| --- | --- |
| Legibility | Body text ≥ 14px on mobile, weights heavy enough on colored backgrounds, no text over busy imagery |
| Hierarchy | One clear primary action per screen; headings, body and meta text are visibly distinct |
| Consistency | Same radii, spacing rhythm, button styles and colors on every page — it looks like one product |
| Layout | Aligned edges, even gutters, nothing cramped in a corner, sensible empty states |
| Responsive | Mobile is designed, not just squeezed: tap targets ≥ 44px, nav collapses cleanly |
| Dark mode | Dark is as finished as light — no white flashes, invisible borders or unreadable badges |
| Library fidelity | Looks like the chosen UI library used properly (see `CLAUDE.md` → UI library), not mixed with stray styles |

Any criterion below 3 is a gate failure. Note the specific element and file for each.

**External judge (optional).** If `visual_qa.judge_command` is set in `~/.config/mesh44/config.json` (e.g. an Eval Central LLM-as-judge run), call it with the shots directory and the rubric above, and use its scores instead of your own:

```bash
<judge_command> --images .app-kit/qa --rubric <plugin>/skills/visual-qa/SKILL.md --out .app-kit/qa/judge.json
```

If the command fails, fall back to your own scoring and say so.

## 6. Fix and re-shoot

Fix the gate failures in the app code (theme tokens in `src/index.css` first, components second), rebuild, and re-run steps 2–5. **At most two fix rounds.** If gates still fail after that, stop and show the user the remaining failures with their screenshots instead of looping.

## 7. Report

One short block:

```
Visual QA: PASS (round 2)  · 12 shots · 0 contrast failures · 0 overflow
Rubric: legibility 4 · hierarchy 4 · consistency 5 · layout 4 · responsive 4 · dark 4 · fidelity 5
Fixed: badge text weight (StatusBadge.tsx), mobile nav overflow (Header.tsx)
```

Keep the latest `.app-kit/qa/*.png` — `/app-kit:promo` reuses them.
