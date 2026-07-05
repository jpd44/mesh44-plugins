---
description: Answer natural-language questions about the user's AWS Organization spend (why costs changed, which app or service grew, forecasts) using local Cost Explorer data. Use when the user asks about their AWS costs in plain language.
---

# /cost:ask — natural-language AWS cost questions

Answer questions like *"why did spend jump in June?"*, *"which app grew the most this quarter?"*, or *"what's my biggest service across every app?"* using the user's **local** cost data. Keep it local-first — work from the on-disk snapshot; don't ship their figures anywhere.

## Get the data

Use the mesh44-cost tool's local snapshot (`jpd44/mesh44-cost`, typically `~/Developer/mesh44-cost/public/data.json`).

1. If `public/data.json` is missing or stale (check its `generatedAt`), refresh it:
   ```bash
   cd ~/Developer/mesh44-cost && AWS_PROFILE=mgt npm run fetch
   ```
   Run `aws sso login --profile mgt` first if the SSO session is expired.
2. Read `public/data.json`. It contains:
   - `months`, `totalsByMonth`, `totalThisMonth`, `totalLastMonth`, `forecastThisMonth`
   - `apps[]` — per account: `name`, `accountId`, `series` (6-month), `current`, `previous`, `topService`
   - `topServices[]` — service + amount for the current month

## Answer

- Compute the specifics from the JSON: deltas, % change, which account/service drove a change, trend direction, forecast vs. last month.
- Cite concrete numbers — e.g. *"June was $58.40, up 42% from May's $41.00, driven by daily-deutsch's load balancer ($44 of it)."*
- If the question needs a dimension the snapshot doesn't have (daily granularity, a specific tag, a service within one account over time), say so and offer to pull it with a targeted Cost Explorer query via the AWS CLI (`aws ce get-cost-and-usage ... --profile mgt`).

## Privacy contract

Read-only, local-first. The data stays on the user's machine; use only the figures needed to answer.
