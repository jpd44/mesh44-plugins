# mesh44 plugins

Personal Claude Code plugins for building and running a portfolio of small, well-architected AWS apps. This is the plugin marketplace behind [mesh44](https://www.mesh44.com).

## Install

```
/plugin marketplace add jpd44/mesh44-plugins
/plugin install app-kit@mesh44
/plugin install cost@mesh44
```

## Plugins

### [app-kit](app-kit/) — scaffold + deploy a new web app

Ship a new web app end-to-end from one command: a private GitHub repo, an isolated AWS child account, an optional Route 53 domain, and a CodePipeline-driven CDK deploy (S3 + CloudFront, with optional Cognito / HTTP API / LLM Lambda).

`/app-kit:new-app` · `/app-kit:preflight` · `/app-kit:aws-account` · `/app-kit:domain` · `/app-kit:github-repo` · `/app-kit:cdk-stack`

Reads `~/.config/mesh44/config.json`. Full setup + prerequisites in **[app-kit/README.md](app-kit/README.md)**.

### [cost](cost/) — local-first AWS spend dashboard

One local view of every app's AWS spend — per-account totals, month-over-month trend, forecast, and top services — plus natural-language questions about it. Uses your own credentials; nothing is stored or sent anywhere. Wraps [jpd44/mesh44-cost](https://github.com/jpd44/mesh44-cost).

`/cost:dashboard` · `/cost:ask`

See **[cost/README.md](cost/README.md)**.

## Configuration

`app-kit` reads a single config at `~/.config/mesh44/config.json` (copy [app-kit/config.json.example](app-kit/config.json.example)). `cost` needs no config beyond the AWS profiles already in your `~/.aws/config`.

## License

MIT — see [LICENSE](LICENSE).
