# devkb

Turn your coding sessions into a **developer knowledge base** in [Obsidian](https://obsidian.md) — capture ideas on demand, or automatically when a session ends. Local-first: everything is read from and written to your own machine, nothing is uploaded anywhere.

Part of the [mesh44](https://github.com/jpd44/mesh44-plugins) plugin marketplace.

## What you get

- **`/devkb:capture`** — an on-demand skill. Say *"save that idea"* or *"grab any ideas from this session"* and Claude writes curated, atomic notes into a `devkb/` folder in your vault, one idea per note, with frontmatter and wikilinks.
- **Automatic session sweep** — a `SessionEnd` hook that, when a coding session wraps up, quietly scans the transcript for genuinely new ideas and appends them to `devkb/Session Inbox.md` for you to triage later. This is the low-confidence catch-net; `/devkb:capture` is the curated path.
- **Startup context (optional)** — a `SessionStart` hook that injects an index of the current project's notes plus `general_learnings/` (titles + summaries) into new sessions, so Claude knows what's already in your knowledge base. Controlled by `obsidian.load_on_startup`.
- **Popularity score** — a `PostToolUse` hook bumps a `references` counter in a note's frontmatter each session it gets read, so your most-reused ideas rise to the top (shown as `⟳N` in the startup index).

## How it's organised

```
<vault>/devkb/
  general_learnings/     cross-project, reusable insights
  <project>/             per-project (e.g. mesh44, derived from the repo)
    Session Inbox.md     auto-swept ideas awaiting triage
```

## Install

```
# inside Claude Code
/plugin marketplace add jpd44/mesh44-plugins
/plugin install devkb@mesh44
```

## Configuration

Reads `~/.config/mesh44/config.json`:

```json
{
  "obsidian": {
    "vault": "/Users/you/Documents/Obsidian Vault",
    "folder": "devkb",
    "load_on_startup": "index"
  }
}
```

- `vault` — defaults to `~/Documents/Obsidian Vault`.
- `folder` — the subfolder notes live in; defaults to `devkb`.
- `load_on_startup` — `"index"` (default: inject titles + summaries at session start), `"full"` (bodies too, until a 10k-char cap), or `"off"`.

## Privacy

- Writes only inside the configured vault, only on your machine.
- The automatic hook runs a local `claude -p` pass over the session transcript to extract ideas — that stays on your machine like any other Claude Code call.
- Nothing about your ideas or sessions is sent anywhere by this plugin.

## Disable the automatic sweep

If you only want the on-demand skill, remove or comment out the hook in `devkb/hooks/hooks.json`, or uninstall and reinstall selecting the skill only.
