#!/usr/bin/env bash
# SessionEnd hook entry for the mesh44 `devkb` plugin.
#
# Reads the SessionEnd JSON on stdin, then detaches a background worker
# (sweep.sh) that extracts durable ideas from the session transcript into the
# Obsidian inbox. We detach so the user's session never blocks on exit — this
# is a best-effort catch-net; /devkb:capture is the reliable, curated path.
set -uo pipefail

# --- recursion guard ---
# The worker runs `claude -p`, which starts a child Claude session whose own
# SessionEnd would re-trigger this very hook. The child inherits this env var
# (we export it when launching the worker), so it no-ops here.
if [[ -n "${MESH44_DEVKB_SWEEP:-}" ]]; then
  exit 0
fi

# Need jq to parse input and claude to extract; bail quietly if either missing.
command -v jq >/dev/null 2>&1 || exit 0
command -v claude >/dev/null 2>&1 || exit 0

input="$(cat)"
transcript="$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null)"
session_id="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)"

[[ -n "$transcript" && -f "$transcript" ]] || exit 0

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/mesh44-devkb"
mkdir -p "$state_dir"
log="$state_dir/sweep.log"

# Detach: nohup + disown so it survives session exit without blocking it.
# (macOS has no `setsid`; nohup ignores SIGHUP and disown drops it from the
# job table.) MESH44_DEVKB_SWEEP=1 arms the recursion guard for the child.
nohup env \
  MESH44_DEVKB_SWEEP=1 \
  DEVKB_TRANSCRIPT="$transcript" \
  DEVKB_SESSION_ID="$session_id" \
  DEVKB_CWD="$cwd" \
  bash "$script_dir/sweep.sh" </dev/null >>"$log" 2>&1 &
disown 2>/dev/null || true

exit 0
