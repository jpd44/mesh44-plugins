#!/usr/bin/env bash
# Background worker for the mesh44 `devkb` plugin. Extracts durable ideas from a
# session transcript and appends them to the Obsidian "Session Inbox" for later
# triage. Best-effort catch-net; the curated path is the /devkb:capture skill.
# Invoked (detached) by capture-ideas.sh with DEVKB_* env vars set.
set -uo pipefail

transcript="${DEVKB_TRANSCRIPT:-}"
session_id="${DEVKB_SESSION_ID:-}"
cwd="${DEVKB_CWD:-}"
[[ -n "$transcript" && -f "$transcript" ]] || exit 0

state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/mesh44-devkb"
mkdir -p "$state_dir"
seen="$state_dir/processed-sessions.txt"
touch "$seen"

# Dedup: SessionEnd can fire more than once for a session (e.g. /clear then exit).
if [[ -n "$session_id" ]] && grep -qxF "$session_id" "$seen" 2>/dev/null; then
  exit 0
fi

# --- resolve vault + ideas dir from config (defaults if unset) ---
config="$HOME/.config/mesh44/config.json"
vault=""; folder="devkb"
if [[ -f "$config" ]]; then
  vault="$(jq -r '.obsidian.vault // empty' "$config" 2>/dev/null)"
  cfg_dir="$(jq -r '.obsidian.folder // empty' "$config" 2>/dev/null)"
  [[ -n "$cfg_dir" ]] && folder="$cfg_dir"
fi
[[ -z "$vault" ]] && vault="$HOME/Documents/Obsidian Vault"
vault="${vault/#\~/$HOME}"      # expand a leading ~
vault="${vault//\$HOME/$HOME}"  # expand a literal $HOME
[[ -d "$vault" ]] || exit 0

# The KB is organised <folder>/general_learnings and <folder>/<project>. A
# session lives in one project, so swept ideas file under that project's inbox.
# Derive a clean project slug from cwd: www.mesh44.com -> mesh44.
project="$(basename "${cwd:-}")"
project="${project#www.}"
for tld in .com .net .org .io .dev .co .app .ai .xyz .sh .me; do project="${project%$tld}"; done
[[ -z "$project" ]] && project="misc"

dest_dir="$vault/$folder/$project"
mkdir -p "$dest_dir"

# --- pull readable text out of the JSONL transcript (user + assistant turns) ---
text="$(jq -r '
  select(.type=="user" or .type=="assistant")
  | .message.content
  | if type=="string" then .
    elif type=="array" then (map(select(.type=="text") | .text) | join("\n"))
    else empty end
' "$transcript" 2>/dev/null)"

# Skip trivial sessions — not worth a model call.
if [[ "${#text}" -lt 400 ]]; then
  [[ -n "$session_id" ]] && echo "$session_id" >>"$seen"
  exit 0
fi

# Cap size to keep the extraction cheap (most recent ~40k chars of the work).
text="$(printf '%s' "$text" | tail -c 40000)"

read -r -d '' prompt <<'EOF' || true
You are extracting durable ideas from a coding-session transcript for a personal
Obsidian inbox. Read the transcript on stdin. Identify ONLY genuinely new ideas
worth keeping — reusable insights, design directions, or things to build that
surfaced during the session. EXCLUDE routine task completion, bug fixes, status
updates, restated requirements, and anything trivial or obvious. Prefer zero
bullets over filler. Output each idea as one markdown bullet exactly like:
"- **Short title** — one-sentence description."
If there are no such ideas, output exactly: NONE
Output nothing else.
EOF

# Fast, cheap model for the extraction pass.
ideas="$(printf '%s' "$text" | claude -p "$prompt" --model claude-haiku-4-5-20251001 2>/dev/null)"

# Mark processed regardless, so we never retry the same session.
[[ -n "$session_id" ]] && echo "$session_id" >>"$seen"

trimmed="$(printf '%s' "$ideas" | tr -d '[:space:]')"
[[ -z "$trimmed" || "$trimmed" == "NONE" ]] && exit 0

# --- append under a dated heading in the inbox ---
inbox="$dest_dir/Session Inbox.md"
date_str="$(date '+%Y-%m-%d %H:%M')"

# Note existence BEFORE the append redirection (>> creates the file, which would
# make an inline -f test always false).
need_header=""
[[ -f "$inbox" ]] || need_header=1

{
  if [[ -n "$need_header" ]]; then
    printf -- '---\ntags: [idea, inbox]\nproject: %s\n---\n\n# %s — Session Inbox\n\nAuto-captured ideas from coding sessions in this project. Triage into atomic notes (see `/devkb:capture`), or promote cross-cutting ones to `../general_learnings/`.\n' "$project" "$project"
  fi
  printf -- '\n## %s\n\n%s\n' "$date_str" "$ideas"
} >>"$inbox"

exit 0
