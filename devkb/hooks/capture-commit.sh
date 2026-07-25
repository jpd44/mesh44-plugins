#!/usr/bin/env bash
# PostToolUse(Bash) hook for the mesh44 `devkb` plugin.
#
# When a real `git commit` runs in a project, snapshot the SESSION'S HIGHLIGHTS
# (ideas, decisions, and learnings from the work leading up to the commit) into
# the project's devkb inbox, tagged with the commit. A commit is a deliberate
# checkpoint — a natural moment to capture what you just figured out.
#
# obsidian.commit_capture in ~/.config/mesh44/config.json: "off" (default) | "on".
# Reuses the extraction worker (sweep.sh); runs detached so the commit never
# blocks on a model call.
set -uo pipefail

# Don't fire inside the sweep's own headless `claude -p` child.
[[ -n "${MESH44_DEVKB_SWEEP:-}" ]] && exit 0
command -v jq >/dev/null 2>&1 || exit 0
command -v git >/dev/null 2>&1 || exit 0

input="$(cat)"
[[ "$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null)" == "Bash" ]] || exit 0
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"

# Must look like a real commit invocation, not a dry-run/help/mention.
printf '%s' "$cmd" | grep -Eq 'git([[:space:]]+-[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)' || exit 0
printf '%s' "$cmd" | grep -Eq -- '--dry-run|--help|(^|[[:space:]])-h([[:space:]]|$)' && exit 0

cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)"
session_id="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)"
transcript="$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null)"
[[ -n "$cwd" && -d "$cwd" ]] || exit 0
[[ -n "$transcript" && -f "$transcript" ]] || exit 0

# --- config gate ---
config="$HOME/.config/mesh44/config.json"
mode="off"
[[ -f "$config" ]] && { v="$(jq -r '.obsidian.commit_capture // empty' "$config" 2>/dev/null)"; [[ -n "$v" ]] && mode="$v"; }
[[ "$mode" == "off" ]] && exit 0

# --- confirm a just-made, not-yet-captured commit ---
full="$(git -C "$cwd" rev-parse HEAD 2>/dev/null)" || exit 0
[[ -n "$full" ]] || exit 0
ct="$(git -C "$cwd" log -1 --format=%ct HEAD 2>/dev/null)"; now="$(date +%s)"
[[ "$ct" =~ ^[0-9]+$ ]] || exit 0
(( now - ct > 120 )) && exit 0   # guards commands that merely mention "git commit"

state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/mesh44-devkb"
mkdir -p "$state_dir"
seen="$state_dir/committed-shas.txt"; touch "$seen"
grep -qxF "$full" "$seen" 2>/dev/null && exit 0
echo "$full" >>"$seen"

short="$(git -C "$cwd" rev-parse --short HEAD 2>/dev/null)"
subject="$(git -C "$cwd" log -1 --format='%s' 2>/dev/null)"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
log="$state_dir/sweep.log"

# Detach the extraction worker so the commit doesn't wait on a model call.
nohup env \
  MESH44_DEVKB_SWEEP=1 \
  DEVKB_TRANSCRIPT="$transcript" \
  DEVKB_SESSION_ID="$session_id" \
  DEVKB_CWD="$cwd" \
  DEVKB_TRIGGER="commit" \
  DEVKB_COMMIT_SHORT="$short" \
  DEVKB_COMMIT_SUBJECT="$subject" \
  bash "$script_dir/sweep.sh" </dev/null >>"$log" 2>&1 &
disown 2>/dev/null || true

exit 0
