---
description: End-to-end scaffolder for a new web app. Walks through local repo setup, AWS child account, optional Route 53 domain, private GitHub repo, and CodePipeline-driven CDK deployment. Confirm with the user before any billable or destructive step.
---

# /app-kit:new-app — full app bootstrap

You are bootstrapping a new web app the way the reference apps `daily-deutsch` and `munichmotoclub` are set up. **You must execute** the local steps and **prompt the user before** any step that costs money, creates a long-lived AWS resource, or registers a domain. The user has opted into "execute with confirmation."

## Assumed starting state

- The user has a populated `~/.config/mesh44/config.json` (copied from `config.json.example` and filled in). Preflight loads it and fails fast if it's missing.
- The user is sitting in `developer_dir` from that config (or one of `developer_dir_symlinks`). All new apps go into `./<app-name>` from there.
- The user is signed into the AWS **management** account via `AWS_PROFILE=mgt`. Preflight verifies the account ID matches `aws.mgt_account_id` from config.
- The user is signed into `gh` and is a member of `github.org` (from config) with `repo` + `admin:org` (or `write:org`) scopes. Preflight verifies this too.

If any of these are missing, preflight stops the run before any directory is created.

## Step 0. Preflight — **run before anything else**

Invoke the `preflight` skill. It checks the config file, local CLIs, AWS `mgt` SSO session, GitHub auth + configured-org membership, and the CDK toolchain.

- If preflight returns **READY**, continue to "Inputs to gather first" below.
- If preflight returns **NEEDS ATTENTION**, **stop** — print the fix list it produced and wait for the user. Don't ask the app-name question yet, and don't run any other step. Once the user says they've fixed things, re-run preflight; only proceed when it comes back READY.

The reason: every later step assumes `AWS_PROFILE=mgt` works and `gh` can push to your configured org. Tearing down a half-created AWS account is much more painful than fixing an expired SSO token up front.

## Inputs to gather first

Ask in **two** AskUserQuestion turns. Split deliberately so creative inputs don't sit next to billable infra decisions.

**Round 1 — infrastructure shape:**

1. **App name** — kebab-case (e.g., `kanji-trainer`). Used as folder name, AWS profile suffix (`child-<name>`), GitHub repo, and CDK stack id.
2. **Stack** — `vite` (React SPA, like daily-deutsch) or `nextjs` (Next.js 15 static export to S3/CloudFront).
3. **Domain** — an apex domain to **register** (e.g., `kanji-trainer.com`), one the user **already owns** (registered in `mgt`, so skip registration and only delegate DNS), or **skip**. If skipped, the app is served only from the CloudFront default URL (`d1234.cloudfront.net`) — no Route 53, no ACM cert, no www→apex redirect.
4. **Cognito auth?** — yes/no. Adds a Cognito UserPool + UserPoolClient, plus (for Vite) shadcn-based SignIn/SignUp/ConfirmSignUp forms, a Forgot-password reset flow, and an `AuthProvider`/`AuthGuard` in `src/`.
5. **Protected HTTP API?** — yes/no. Adds an API Gateway HTTP API with a Cognito JWT authorizer and one sample Lambda at `GET /hello`. **Requires Cognito** — if the user picks "API yes / Cognito no," tell them and re-ask.
6. **LLM Lambda?** — yes/no. A Lambda that proxies Bedrock. **With the protected API (5) on, it is mounted as `POST /llm` behind the Cognito JWT authorizer and has no public URL. This is the default; recommend it.** Without the API, it falls back to the daily-deutsch pattern: an *unauthenticated* Lambda Function URL with CORS only. Anyone who finds that URL can spend Bedrock tokens, so say this when the user picks LLM without the API, and offer to turn on Cognito + API instead.

Treat 4/5/6 as three separate toggles. Don't bundle them.

**Round 2 — what to build:**

7. **App description** — free-form text describing what the app does. Examples: *"joke website with language selector and culturally relative jokes"*, *"flashcard app for kanji with SRS scheduling"*, *"checklist tracker that syncs to localStorage"*. **Required** — step 1b uses this to produce a real first iteration of the app. If the user types nothing, ask again or default to "minimal landing page with the app name as the title."
8. **Design reference URL (optional)** — a URL to a Claude Designer artifact, Stitch project, Figma frame, Dribbble shot, or any other design source. Anything `WebFetch` (or the Stitch MCP) can reach. Leave blank to skip.
9. **Style reference URL (optional)** — a URL to an existing website whose visual language to mimic (palette, typography, density, sharp vs. rounded). E.g., `https://linear.app`, `https://daily-deutsch.com`. Leave blank to skip.

## Step sequence

Run these in order **after** preflight has passed. After each, give a one-line status update and move on. **Mark TaskCreate tasks per step** so the user can see progress.

### 1. Local scaffold + git init (no confirmation needed)

- Confirm `cwd` matches `developer_dir` from config (preflight should have already checked, but re-verify cheaply with `pwd`). The project goes in `./<app-name>/` relative to `cwd` — **do not** use an absolute hard-coded path; the new project always lives at `./<app-name>` from the configured Developer dir.
- For Vite, scaffold first (create-vite wants an empty target dir), from the Developer dir:
  ```bash
  CI=1 npm create vite@latest <app-name> -- --template react-ts --no-interactive
  ```
  Current create-vite gives React 19, TypeScript 7, oxlint (`npm run lint`), and `erasableSyntaxOnly` in `tsconfig.app.json`. Keep them; don't downgrade to match older apps. Then, in order:
  1. `npm install tailwindcss @tailwindcss/vite`, add `tailwindcss()` and a `resolve.alias` of `'@' → ./src` to `vite.config.ts`, and set `src/index.css` to `@import "tailwindcss";` (Tailwind 4: no `tailwind.config`). If Cognito is on, also add `define: { global: 'globalThis' }` (see the `cdk-stack` skill's Cognito step).
  2. Add `"paths": { "@/*": ["./src/*"] }` and `"strict": true` to `tsconfig.app.json` **and** `paths` to `tsconfig.json`. Don't add `baseUrl`, because TypeScript 7 removed it. Edit these files by hand or with a JSONC-aware tool: they contain comments, so `JSON.parse` fails.
  3. **Only then** run `CI=1 npx shadcn@latest init --yes --defaults`. Even with the alias in place, current shadcn can write `import { cn } from "cn"` (and `export { cn } from "cn"` in `src/lib/utils.ts`) **and** add the unrelated `cn` npm package to `dependencies`. Always check and repair it:
     ```bash
     if grep -rq 'from "cn"' src || grep -q '"cn":' package.json; then
       npm uninstall cn && npm install clsx tailwind-merge
       printf '%s\n' 'import { clsx, type ClassValue } from "clsx"' 'import { twMerge } from "tailwind-merge"' '' 'export function cn(...inputs: ClassValue[]) {' '  return twMerge(clsx(inputs))' '}' > src/lib/utils.ts
       grep -rl 'from "cn"' src/components | xargs sed -i '' 's#from "cn"#from "@/lib/utils"#'
     fi
     ```
     Re-run the `grep` after every `npx shadcn@latest add`, since new components can bring the bad import back.
  4. shadcn's default theme imports `@fontsource-variable/geist`. If you switch fonts, remove that `@import` from `src/index.css` too, or the build fails.
  5. Delete the Vite boilerplate (`src/App.css`, `src/assets/*`, `public/icons.svg`) and replace `public/favicon.svg`.
- For Next.js: create `./<app-name>/` and, inside it, `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-eslint --import-alias '@/*'`, then set `output: 'export'` in `next.config.ts`.
- Then, inside `./<app-name>/`: `git init -b main` and copy `templates/shared/CLAUDE.md`, `templates/shared/mise.toml`, `templates/shared/buildspec.yml`, `templates/shared/buildspec-test.yml`, `templates/shared/.gitignore`, replacing `{{APP_NAME}}`, `{{DOMAIN}}` (empty string if skipped), `{{AWS_PROFILE}}` (set to `child-<app-name>` even though the account doesn't exist yet — first commit ships with the intended value), `{{BUILD_OUTPUT_DIR}}` (`dist` for Vite, `out` for Next.js), `{{GITHUB_OWNER}}` (`github.org` from config), and in `CLAUDE.md` `{{APP_DESCRIPTION}}` (from round 2) and `{{ARCHITECTURE_NOTES}}` (write these after step 1b, once the code exists). Merge `.gitignore` with the one the scaffolder wrote rather than overwriting it.
- Copy `templates/<stack>/cdk/` into `./<app>/cdk/`. **Rename `lib/stack.ts` to `lib/<app-name>-stack.ts`.** Strip the block markers per the matrix in the `cdk-stack` skill, but **leave `{{AWS_ACCOUNT_ID}}` as-is in `cdk/bin/app.ts`** — we don't have the real ID yet; step 3 will fill it in.

### 1b. First-cut implementation from description + design refs (no confirmation)

This is what makes the initial commit *meaningful* instead of "Vite scaffold + my project name." Use the round-2 inputs.

1. **Fetch design references.** If `design_reference_url` is set, `WebFetch` it (or use the Stitch MCP — `mcp__stitch__get_project` / `mcp__stitch__get_screen` — if the URL points at a Stitch project). If `style_reference_url` is set, `WebFetch` it and extract the design language: dominant colors, font families, spacing rhythm, corner radii, shadow style, button shape, density. Capture 3–5 concrete design facts. Don't try to clone the site.

2. **Delegate frontend generation to the `frontend-design` skill** (the user has `frontend-design:frontend-design` enabled). Hand it:
   - The `app_description`.
   - The 3–5 design facts you extracted (or "no reference provided — pick a coherent visual language" if both URLs were blank).
   - The constraint that output must fit the round-1 stack and feature toggles.
   The `frontend-design` skill should produce a credible first iteration — real pages, real typed data shapes, real interactions — not stub pages.

3. **Constraints to enforce when delegating:**
   - Stay within the round-1 stack (Vite + React OR Next.js 15).
   - Use shadcn/ui primitives in `src/components/ui/`; install via `npx shadcn@latest add <name>` as needed.
   - Use Tailwind for layout; put the extracted palette/fonts in `@theme` tokens in `src/index.css` (Tailwind 4) or `tailwind.config` (Next.js, if it ships Tailwind 3).
   - Placeholder content: don't invent real-world facts, quotes, prices or stats that would go live on a public domain. Use clearly marked placeholders, as the design reference does.
   - **Don't** add features round 1 didn't authorize. If Cognito=no, the first cut must work without auth. If API=no, all data must be client-side (typed arrays or `localStorage`).
   - Keep it tight — ~5–10 files of real app code, not a full product.

4. **Sanity-check the build.** Run `npm run build`. It must pass before step 2 — a broken build in the initial commit blocks the CodePipeline from ever turning green.

5. If both `design_reference_url` and `style_reference_url` are blank, still call `frontend-design` with just the description; it's much better at making aesthetic choices than the bare template.

### 2. GitHub repo + initial commit — execute, no prompt

This step happens **before** AWS provisioning so the codebase is under version control immediately. Even if AWS account creation later fails or stalls, the user keeps a versioned scaffold they can return to.

Defer to the `github-repo` skill (which loads `github.org` from config):
- `git add . && git commit -m "Initial scaffold + first cut: <one-line summary of app_description>"`.
- `gh repo create $GH_ORG/<app-name> --private --source . --remote origin --push`.
- Print the repo URL.

The first commit now contains both the infra scaffold AND the real first iteration of the app from step 1b — someone landing on the repo cold can `npm install && npm run dev` and immediately see the idea, not a blank Vite page.

The first commit will still contain `{{AWS_ACCOUNT_ID}}` placeholder in `cdk/bin/app.ts`. That's fine — `cdk synth` isn't run until step 5 once the real account exists, and step 3 commits the substitution as a follow-up.

### 3. AWS child account — **prompt before creating**

Defer to the `aws-account` skill. Surface the cost (Organizations is free; account is empty until provisioned) and ask the user to confirm before `aws organizations create-account` runs. After creation, wait until the new account ID appears in `aws organizations list-accounts` and update `~/.aws/config` with a `child-<app-name>` SSO profile.

Then **back in the app directory**: replace `{{AWS_ACCOUNT_ID}}` in `cdk/bin/app.ts` with the real value, then `git add cdk/bin/app.ts && git commit -m "Wire AWS account ID" && git push`.

### 4. Route 53 domain — **skip entirely if the user opted out**

If the user picked **skip** for the domain, do nothing here and proceed to step 5.

If the user **already owns** the domain, skip the `domain` skill's availability and registration steps and run its "Existing domain" path: hosted zone in the child account, then name-server delegation. Changing a live domain's name servers is outward-facing, so confirm with the user first.

Otherwise, defer to the `domain` skill. Check availability with `aws route53domains check-domain-availability`, **quote the annual price** from `get-domain-suggestions`, and only register after explicit user OK. Registration runs in the management account (`AWS_PROFILE=mgt`) because that's where billing lives, but the hosted zone is created in the **child** account so the CDK stack there can look it up.

### 5. CDK first deploy — **prompt before `cdk deploy`**

Defer to the `cdk-stack` skill. Bootstrap the child account (`cdk bootstrap aws://<account-id>/us-east-1`), then `cdk deploy` after the user OKs the resources. After deploy, print the `AuthorizeConnectionUrl` output — the user **must** click through it to finish wiring the GitHub connection before the pipeline can pull source.

If `needs_cognito=true`, also write `.env.local` from the stack outputs and commit it to `.gitignore` (don't commit secrets) — then commit the new frontend files (`src/lib/auth.ts`, `src/components/Auth*.tsx`, etc.) with `git add . && git commit -m "Wire Cognito auth" && git push`.

### 6. Wrap up

- Open the new project in the user's editor (`code <path>` if VS Code is installed; otherwise just print the path).
- Print a final checklist: authorize CodeStar connection, push any change to `main` to verify the pipeline runs end-to-end, if the LLM Lambda was selected, note that a brand-new account returns Bedrock `AccessDeniedException: …being verified` for up to ~2 hours (wait it out), and Anthropic models may ask for a one-time use-case form in the Bedrock console. The old per-model "Model access" page is retired; models auto-enable on first invoke.

## Guardrails

- **Never** run `cdk destroy`, `aws organizations close-account`, or `gh repo delete` without an explicit user request.
- If any step fails, **stop and report**. Don't try to "fix forward" by deleting half-created resources — the user will want to inspect them first.
- If `mise` is not installed locally, prompt the user to `brew install mise` rather than installing it yourself.
- All AWS commands must run with `AWS_PROFILE` set explicitly. Never assume the shell already has the right profile.
