# cost

A local-first Claude Code plugin for AWS Organization spend. It wraps the [mesh44-cost](https://github.com/jpd44/mesh44-cost) dashboard: per-app spend, month-over-month trend, forecast, and top services — using your own AWS credentials, with nothing stored or sent anywhere.

## Install

```
/plugin marketplace add jpd44/mesh44-plugins
/plugin install cost@mesh44
```

## Commands

| Skill | What it does |
| --- | --- |
| `/cost:dashboard` | Clone/launch the mesh44-cost web dashboard locally and open it in the browser. Pulls Cost Explorer data with your chosen AWS profile (default `mgt`). |
| `/cost:ask` | Answer natural-language questions about your spend ("why did June jump?", "which app grew most?") from the local data snapshot. |

## Prerequisites

- AWS Cost Explorer enabled on the management/payer account (one-time, in the console).
- AWS CLI signed into the payer account for org-wide data: `aws sso login --profile mgt`.
- Read-only IAM: `ce:GetCostAndUsage`, `ce:GetCostForecast`, `organizations:ListAccounts`.

## Privacy

Everything runs on your machine with your credentials. The dashboard writes a local, gitignored `data.json`; there is no mesh44 server in the path. Source: [jpd44/mesh44-cost](https://github.com/jpd44/mesh44-cost).
