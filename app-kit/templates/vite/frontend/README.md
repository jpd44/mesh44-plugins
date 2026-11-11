# Frontend auth bundle

These files get copied into the new app's `src/` when **Cognito** is selected in `/app-kit:new-app`. They wire up Cognito user pools to the daily-deutsch-style auth UI (one `LoginForm` card for sign in, sign up, email confirmation, forgot/reset password and the invite new-password step; a `UserMenu` avatar dropdown for the top-right of the header; an `AccountView` profile page with change password) and provide an `apiFetch` helper that attaches the user's ID token to every protected request.

## What gets copied where

| Template file | Destination in the new app |
| --- | --- |
| `lib/auth.ts` | `src/lib/auth.ts` |
| `lib/api.ts` | `src/lib/api.ts` (only if HTTP API block was also picked) |
| `components/AuthProvider.tsx` | `src/components/AuthProvider.tsx` |
| `components/AuthGuard.tsx` | `src/components/AuthGuard.tsx` |
| `components/LoginForm.tsx` | `src/components/LoginForm.tsx` |
| `components/UserMenu.tsx` | `src/components/UserMenu.tsx` |
| `components/AccountView.tsx` | `src/components/AccountView.tsx` |
| `components/SignedInShell.tsx` | `src/components/SignedInShell.tsx` |
| `pages/AccountPage.tsx` | `src/pages/AccountPage.tsx` (replace `{{APP_NAME}}`) |
| `.env.example` | `.env.example` (merge with any existing file) |

## Required npm deps (the orchestrator installs these)

```bash
npm i amazon-cognito-identity-js
```

**Required Vite fix:** `amazon-cognito-identity-js` reads Node's `global`, which browsers don't have. Without this, every page that loads the SDK renders blank with `ReferenceError: global is not defined`, and only in the production build. Add to `vite.config.ts`:

```ts
// amazon-cognito-identity-js reads Node's `global`; browsers only have globalThis.
define: { global: 'globalThis' },
```

Check it by loading the signed-in route from `npm run build && npx vite preview`, not only the home page.

## Required shadcn primitives

```bash
npx shadcn@latest add button input label card
```

## Wiring it into `App.tsx`

Every signed-in page wraps itself in `SignedInShell`: login card first, then a header with the app name on the left and the **account dropdown in the top-right corner** (Profile, Change password, Sign out, plus any `menuItems` you pass). The dropdown's Profile and Change password items link to `/account`, so always add that route.

`SignedInShell` props: `appName` (required), `icon` (the login card's badge, defaults to a lock), `allowSignUp` (default `true`; pass `false` when the pool is invite-only, which also enables the invite "choose your password" flow), `menuItems` (`[{ label, href, icon }]`).

First decide which part of the app needs sign-in; the orchestrator asks if the app description doesn't make it obvious.

**Whole app behind sign-in** (a private tool):

```tsx
import { lazy, Suspense } from "react";
import { SignedInShell } from "@/components/SignedInShell";

const AccountPage = lazy(() => import("@/pages/AccountPage"));

export default function App() {
  if (window.location.pathname.startsWith("/account")) {
    return <Suspense fallback={null}><AccountPage /></Suspense>;
  }
  return <SignedInShell appName="my-app">{/* your existing app */}</SignedInShell>;
}
```

**Public site with a signed-in area** (e.g. `/editor`): guard only those routes and lazy-load them, so public pages never ship the Cognito SDK. CloudFront already rewrites unknown paths to `index.html`, so a pathname check is enough for a few routes:

```tsx
// src/App.tsx
import { lazy, Suspense } from "react";
import HomePage from "@/pages/HomePage";

const EditorPage = lazy(() => import("@/pages/EditorPage"));   // renders <SignedInShell appName=…>…</SignedInShell>
const AccountPage = lazy(() => import("@/pages/AccountPage"));

export default function App() {
  const p = window.location.pathname;
  if (p.startsWith("/account")) return <Suspense fallback={null}><AccountPage /></Suspense>;
  if (p.startsWith("/editor")) return <Suspense fallback={null}><EditorPage /></Suspense>;
  return <HomePage />;   // its header can link "Sign in" to /editor
}
```

**Invite-only pools** (`selfSignUpEnabled: false`): pass `allowSignUp={false}` to `SignedInShell` (and in `AccountPage`). Invite with `aws cognito-idp admin-create-user --user-pool-id <id> --username <email> --user-attributes Name=email,Value=<email> Name=email_verified,Value=true`; the emailed temporary password triggers `LoginForm`'s "choose your password" step on first sign-in.

## Hitting the protected `/hello` endpoint

```tsx
import { apiFetch } from "@/lib/api";

const data = await apiFetch<{ message: string; sub: string }>("/hello");
```

`apiFetch` reads `VITE_API_URL`, grabs the current ID token via `getIdToken()`, and rejects with `ApiError(401)` if the user isn't signed in. The Lambda gets the user's claims via `event.requestContext.authorizer.jwt.claims`.

## Local dev

After the first `cdk deploy`, copy `.env.example` to `.env.local` and fill in the values from CloudFormation outputs:

```bash
AWS_PROFILE=child-<app> aws cloudformation describe-stacks --stack-name <Pascal>Stack \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId` || OutputKey==`UserPoolClientId` || OutputKey==`ApiUrl`]'
```

## Calling the LLM Lambda (when the API is on)

With the protected API enabled, the Bedrock Lambda is `POST /llm` behind the same JWT authorizer, so call it through `apiFetch` like any other route:

```tsx
const { text } = await apiFetch<{ text: string }>("/llm", {
  method: "POST",
  body: JSON.stringify({ prompt }),
});
```

The template Lambda forwards `prompt` as-is. For a real feature, build the prompt server-side from bounded fields instead (see reelpostcard's `/caption`), so signed-in users can't use it as a general-purpose LLM.
