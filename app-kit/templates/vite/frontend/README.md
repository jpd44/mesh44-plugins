# Frontend auth bundle

These files get copied into the new app's `src/` when **Cognito** is selected in `/app-kit:new-app`. They wire up Cognito user pools to a shadcn-based sign-in/sign-up UI and provide an `apiFetch` helper that attaches the user's ID token to every protected request.

## What gets copied where

| Template file | Destination in the new app |
| --- | --- |
| `lib/auth.ts` | `src/lib/auth.ts` |
| `lib/api.ts` | `src/lib/api.ts` (only if HTTP API block was also picked) |
| `components/AuthProvider.tsx` | `src/components/AuthProvider.tsx` |
| `components/AuthGuard.tsx` | `src/components/AuthGuard.tsx` |
| `components/SignInForm.tsx` | `src/components/SignInForm.tsx` |
| `components/SignUpForm.tsx` | `src/components/SignUpForm.tsx` |
| `components/ConfirmSignUpForm.tsx` | `src/components/ConfirmSignUpForm.tsx` |
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

First decide which part of the app needs sign-in; the orchestrator asks if the app description doesn't make it obvious.

**Whole app behind sign-in** (a private tool):

```tsx
import { AuthProvider } from "@/components/AuthProvider";
import { AuthGuard } from "@/components/AuthGuard";

export default function App() {
  return (
    <AuthProvider>
      <AuthGuard>
        {/* your existing app */}
      </AuthGuard>
    </AuthProvider>
  );
}
```

**Public site with a signed-in area** (e.g. `/editor`, `/account`): guard only that route and lazy-load it, so public pages never ship the Cognito SDK. CloudFront already rewrites unknown paths to `index.html`, so a pathname check is enough for one or two routes:

```tsx
// src/App.tsx
import { lazy, Suspense } from "react";
import HomePage from "@/pages/HomePage";

const AccountPage = lazy(() => import("@/pages/AccountPage")); // wraps itself in AuthProvider + AuthGuard

export default function App() {
  if (window.location.pathname.startsWith("/account")) {
    return <Suspense fallback={null}><AccountPage /></Suspense>;
  }
  return <HomePage />;
}
```

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
