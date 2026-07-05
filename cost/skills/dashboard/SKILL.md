---
description: Launch the mesh44-cost local dashboard — per-app AWS Organization spend, trends, forecast, and top services, using the user's own AWS credentials. Use when the user wants to see, open, or refresh their AWS cost dashboard.
---

# /cost:dashboard — launch the local spend dashboard

Bring up the mesh44-cost web dashboard on the user's machine. It reads AWS Cost Explorer with the user's own credentials and renders locally. **Nothing is uploaded anywhere.**

## Where the app lives

The dashboard is a standalone Vite app in the `jpd44/mesh44-cost` repo.

1. If the user already has a clone (check `~/Developer/mesh44-cost`, or ask), use it.
2. Otherwise clone it:
   ```bash
   git clone https://github.com/jpd44/mesh44-cost.git ~/Developer/mesh44-cost
   ```
3. `cd` into it and run `npm install` if `node_modules` is missing.

## Pick the AWS profile

Org-wide spend requires the **management / payer** account. Ask which profile to use (default `mgt`) and make sure the SSO session is live:

```bash
aws sts get-caller-identity --profile mgt >/dev/null 2>&1 || aws sso login --profile mgt
```

A child-account profile only shows that one account's spend — fine for scoping down, but tell the user that's what they'll see.

## Launch

```bash
cd ~/Developer/mesh44-cost
AWS_PROFILE=mgt npm run dashboard   # fetch real data + start the local server
```

This writes a local, gitignored `public/data.json` and serves the dashboard at `http://127.0.0.1:5188`. Open that URL for the user. The dashboard also has an in-app profile dropdown + refresh, so they can switch accounts without restarting.

Data only, no UI: `AWS_PROFILE=mgt npm run fetch`.

## Privacy contract

- Runs only on the user's machine, with the user's credentials.
- `public/data.json` stays local and gitignored — never commit it, never send it anywhere.
- Read-only IAM: `ce:GetCostAndUsage`, `ce:GetCostForecast`, `organizations:ListAccounts`.
- Cost Explorer API calls cost ~$0.01 each; a refresh is a handful of calls.
