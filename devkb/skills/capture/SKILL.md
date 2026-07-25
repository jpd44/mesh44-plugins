---
description: Save an idea from the current coding session into the user's Obsidian vault as an atomic note. Use when the user says "save that idea", "capture this", "note that down", "add this to Obsidian", or wants to sweep the session for ideas worth keeping.
---

# /devkb:capture — save session ideas to your Obsidian knowledge base

Turn ideas that came up while working into durable, linkable notes in the user's Obsidian vault. Two modes:

- **A specific idea** — the user points at one thing ("save that idea about caching the cost snapshot"). Capture just that.
- **Sweep the session** — the user asks to capture everything worth keeping ("grab any ideas from this session"). Scan the conversation and pull out the genuinely new, reusable ideas.

Curate. An idea worth a note is a *reusable insight, design direction, or thing-to-build* — not a task you just finished, a bug you fixed, or routine status. When in doubt, prefer fewer, sharper notes over many thin ones.

## Where the vault is

Read the vault path from `~/.config/mesh44/config.json`:

```json
{
  "obsidian": {
    "vault": "/Users/<you>/Documents/Obsidian Vault",
    "folder": "devkb"
  }
}
```

- Notes go in a `devkb` folder inside the vault. If `obsidian.folder` is unset, default to `devkb`; if the `obsidian` key is missing entirely, default to `~/Documents/Obsidian Vault` and `devkb` — and tell the user you're using the default and they can set `obsidian.vault` / `obsidian.folder` to change it.
- If the vault directory doesn't exist, ask the user for the vault path rather than guessing. Never write outside the vault.
- Create `<vault>/<folder>/` if it doesn't exist yet.

## Where in the folder — general vs project

The `<folder>/` is organised into two kinds of subfolder:

- **`<folder>/general_learnings/`** — cross-project, reusable insights: a pattern, a gotcha, a principle, a technique that would apply on any project.
- **`<folder>/<project>/`** — anything specific to the project this session is about (an idea for *this* app, a decision, a thing to build here).

For each idea, decide which it is. Derive `<project>` as a clean slug from the repo/cwd — e.g. a session in `www.mesh44.com` is project **`mesh44`** (drop a leading `www.` and a trailing TLD-like suffix). If a matching project folder already exists, reuse it exactly rather than making a near-duplicate. When genuinely unsure, prefer the project folder — it's easy to promote to `general_learnings/` later.

## Writing a note

One idea = one atomic note. Filename: `<folder>/<general_learnings|project>/YYYY-MM-DD <short-kebab-slug>.md` (get the date from `date +%F`). If a file with that name exists, append ` 2`, ` 3`, … to the slug. Create the subfolder if needed.

Note body:

```markdown
---
created: YYYY-MM-DD
source: coding-session
project: <project slug, or "general" for a general learning>
tags: [idea]
references: 0
---

# <One-line title of the idea>

<2–5 sentences: what the idea is and why it's worth keeping. Enough that it makes sense months later with zero memory of this session.>

**Next step (optional):** <the smallest concrete thing that would move it forward>

Linked: [[<related note or topic>]]
```

Guidance:
- Always seed `references: 0` — a `PostToolUse` hook bumps it each session the note gets read, giving you a popularity score. Don't hand-edit it afterward.
- Add topical tags beyond `idea` when obvious (e.g. `aws`, `mesh44`, `dx`). Keep them lowercase-kebab.
- Use `[[wikilinks]]` for concepts the vault might already have a note on — a dangling link is fine, it's a breadcrumb.
- Write in the user's voice: plain, concrete, no marketing gloss.

After writing, tell the user exactly which files you created (paths relative to the vault, including the subfolder) and a one-line summary of each, so they can eyeball them.

## Relationship to the automatic hook

This plugin also runs a `SessionEnd` hook that auto-sweeps finished sessions into `<folder>/Session Inbox.md` for later triage. That path is intentionally *low-confidence* — a catch-net. `/devkb:capture` is the *high-confidence, curated* path: notes you make here are atomic and considered, and should be treated as the real ones. If the user is triaging the inbox, help promote inbox bullets into proper atomic notes using the format above.

## Privacy contract

- Runs only on the user's machine and writes only inside the configured vault.
- Nothing is uploaded anywhere; ideas never leave the user's disk.
