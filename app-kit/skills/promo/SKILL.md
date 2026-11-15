---
description: Make a 15–20 second promo video for an app-kit app with Remotion — real screenshots of the app, kinetic type, the app's own colors, rendered as 9:16 (Reels/Shorts/LinkedIn) and 16:9 (site hero) MP4s. Runs as an optional step of /new-app; also use it on any app-kit app ("make a promo", "social ad", "demo video").
---

# /app-kit:promo — a promo video for the app

Turns the app into a short promo video using code, not an editor: a Remotion project in `promo/` driven by one `storyboard.json`. The app's real screens come from the visual-qa screenshots, so nothing in the video is mocked.

Run it from the app's root directory. No confirmation needed: everything is local and nothing is published.

## 1. Gather the material

- **What the app does:** `CLAUDE.md` → Project section (the round-2 description).
- **Colors and fonts:** the app's theme tokens (`@theme` / `:root` variables in `src/index.css`, or `app/globals.css` for Next.js). Use the app's primary, accent, background and foreground. Fall back to `brand` in `~/.config/mesh44/config.json` if the app has no clear palette.
- **Screens:** take promo-quality screenshots (2× density, viewport-sized, no full-page stitching):
  ```bash
  node ~/.cache/mesh44/visual-qa/shoot.mjs --base http://localhost:4173 --out .app-kit/promo-shots --promo --routes / /<best-route> /<another>
  ```
  (Serve the build and install the tooling as in `/app-kit:visual-qa` steps 1–2.) Use the `mobile-*` shots for 9:16 and the `desktop-*` shots for 16:9; pick light or dark to match the brand background.
- **Studio brand:** `brand` in config (logo path, `cta`, optional `background_loop` video).

## 2. Scaffold `promo/`

```bash
cp -R <plugin>/templates/promo ./promo
cd promo
sed -i '' 's/{{APP_NAME}}/<app-name>/' package.json   # GNU sed: sed -i 's/…/…/'
npm install --no-audit --no-fund
cp ../.app-kit/promo-shots/<chosen>.png public/shot-1.png   # shot-2, shot-3 …
```

Copy the logo into `public/` if `brand.logo` is set, and `brand.background_loop` (e.g. a Blender-rendered mesh loop) to `public/` if set. The loop does not repeat, so it must be at least as long as the video.

Recommended once per machine, so you write better Remotion code: `npx skills add remotion-dev/skills`.

## 3. Write the storyboard

Edit `promo/storyboard.json`. Scene types: `title`, `terminal`, `checklist`, `screens`, `quote`, `endcard` (schema in `src/types.ts`). Default shape, 15–20 seconds total:

| Time | Scene | Job |
| --- | --- | --- |
| 0–2.5 s | `title` | The hook: the problem or the payoff in ≤ 6 words |
| 2.5–9.5 s | `screens` | 2–3 real screens with a short caption |
| 9.5–14 s | `checklist` | 3 concrete things the app does |
| 14–17 s | `endcard` | App name, CTA (domain or `SiteUrl`), footnote `Built with mesh44 app-kit` |

**Copy rules** (most AI promo copy fails here):
- Short, concrete and specific to this app. Verbs and nouns, not adjectives.
- No "revolutionize", "seamless", "unlock", "supercharge", "game-changer", "effortless", "in seconds".
- No invented numbers, user counts, ratings or testimonials. Only claims the app actually supports.
- At most ~8 words on screen at once; nothing smaller than the template's sizes.

Each new app's endcard footnote is a small ad for app-kit itself. Keep it unless the user says otherwise.

## 4. Check frames before rendering

```bash
npm run typecheck
for f in 30 120 240 400; do npx remotion still src/index.ts Promo-9x16 out/check-$f.png --props=./storyboard.json --frame=$f; done
```

Read the PNGs. Check that text is inside the safe zones (the template pads ~22% top / ~34% bottom on vertical video for platform UI), nothing overflows or wraps awkwardly, screenshots are sharp, and the palette matches the app. Fix `storyboard.json` (or `src/Promo.tsx` for layout) and re-check. `npm run studio` opens Remotion Studio for the user to scrub through interactively.

## 5. Render

```bash
npm run render          # out/promo-9x16.mp4 and out/promo-16x9.mp4
```

If Remotion can't download its headless Chrome, add `--browser-executable=<path to Chrome>` to the render commands.

`promo/out/` and `promo/node_modules/` are gitignored. Commit `promo/` (source, storyboard, screenshots) so the video can be re-rendered after UI changes:

```bash
cd .. && git add promo && git commit -m "Add promo video source" && git push
```

## 6. Report

Print the two MP4 paths, their lengths, and a one-line description of each scene. Mention that `npm run studio` inside `promo/` lets them tweak it, and that re-running `/app-kit:visual-qa` → `/app-kit:promo` after UI changes refreshes the screens.

**Licensing:** Remotion is free for individuals and small companies; larger companies need a Remotion company license. Say this once if the user is producing videos for a client.

## The app-kit advert

`templates/promo/storyboards/app-kit-advert.json` is the 20-second advert for app-kit itself (hook → `/app-kit:new-app` in a terminal → checklist of what it provisions → a live app → the Amplify line → mesh44 endcard). To render it, scaffold `promo/` as above in any app-kit app, copy that storyboard over `storyboard.json`, add `logo.svg`, three `shot-N.png` screens and `mesh-loop.mp4` (the Blender mesh background) to `public/`, then `npm run render`.
