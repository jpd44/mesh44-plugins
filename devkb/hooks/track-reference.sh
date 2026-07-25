#!/usr/bin/env bash
# PostToolUse(Read) hook for the mesh44 `devkb` plugin.
#
# When Claude reads a devkb note during a session, bump a `references` counter in
# that note's frontmatter — a "popularity" score for your own notes and ideas.
# Deduped per session, so it counts DISTINCT sessions that pulled the note, not
# repeated reads within one session.
set -uo pipefail

# Don't count reads made by the auto-sweep's headless child.
[[ -n "${MESH44_DEVKB_SWEEP:-}" ]] && exit 0
command -v jq >/dev/null 2>&1 || exit 0

input="$(cat)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null)"
[[ "$tool" == "Read" ]] || exit 0

file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
session_id="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)"
[[ -n "$file" && -f "$file" && "$file" == *.md ]] || exit 0
[[ "$(basename "$file")" == "Session Inbox.md" ]] && exit 0

# --- must be a note inside the configured KB ---
config="$HOME/.config/mesh44/config.json"
vault=""; folder="devkb"
if [[ -f "$config" ]]; then
  vault="$(jq -r '.obsidian.vault // empty' "$config" 2>/dev/null)"
  cfg_dir="$(jq -r '.obsidian.folder // empty' "$config" 2>/dev/null)"
  [[ -n "$cfg_dir" ]] && folder="$cfg_dir"
fi
[[ -z "$vault" ]] && vault="$HOME/Documents/Obsidian Vault"
vault="${vault/#\~/$HOME}"; vault="${vault//\$HOME/$HOME}"
root="$vault/$folder"
case "$file" in "$root"/*) : ;; *) exit 0 ;; esac

# --- dedup per (session, note) ---
state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/mesh44-devkb"
mkdir -p "$state_dir"
seen="$state_dir/refs-${session_id:-nosession}.txt"
touch "$seen"
grep -qxF "$file" "$seen" 2>/dev/null && exit 0
echo "$file" >>"$seen"

# --- read current count, increment, rewrite frontmatter atomically ---
old="$(awk '
  BEGIN{fm=0}
  NR==1 && $0=="---"{fm=1; next}
  fm==1 && $0=="---"{exit}
  fm==1 && $0 ~ /^references:/{v=$0; sub(/^references:[ \t]*/,"",v); print v; exit}
' "$file" 2>/dev/null)"
[[ "$old" =~ ^[0-9]+$ ]] || old=0
new=$((old + 1))
today="$(date +%F)"

tmp="$(mktemp "${TMPDIR:-/tmp}/devkb-ref.XXXXXX")" || exit 0
awk -v n="$new" -v d="$today" '
  BEGIN { infm=0; inserted=0 }
  NR==1 {
    if ($0=="---") { print; infm=1; next }
    # No frontmatter — create one, then emit the original first line.
    print "---"; print "references: " n; print "last_referenced: " d; print "---"; print ""
    print; next
  }
  infm==1 {
    if ($0=="---") {
      if (!inserted) { print "references: " n; print "last_referenced: " d; inserted=1 }
      print; infm=0; next
    }
    if ($0 ~ /^references:/) next
    if ($0 ~ /^last_referenced:/) next
    print; next
  }
  { print }
' "$file" >"$tmp" 2>/dev/null && mv "$tmp" "$file" || rm -f "$tmp"

exit 0
