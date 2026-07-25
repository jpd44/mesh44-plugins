#!/usr/bin/env bash
# SessionStart hook for the mesh44 `devkb` plugin.
#
# Optionally injects an index of the Obsidian knowledge base into the session at
# startup, so Claude knows what's already in the KB and can open the full note (a
# plain file) when a topic is relevant. Controlled by obsidian.load_on_startup in
# ~/.config/mesh44/config.json: "index" (default) | "full" | "off".
#
# The KB is organised <folder>/general_learnings and <folder>/<project>. On
# startup we load the CURRENT project's notes plus general_learnings — the slice
# relevant to this session — not every project.
#
# Output contract: print JSON with hookSpecificOutput.additionalContext. There is
# a hard 10,000-char cap on that field, so we index (title + summary + tags),
# newest first, and stop before the cap rather than dumping whole notes.
set -uo pipefail

CAP=9000  # leave headroom under the 10k hard limit for the wrapper text

# Don't load the KB into the auto-sweep's headless `claude -p` child — wasteful
# and off-purpose. capture-ideas.sh exports this when it launches the sweep.
[[ -n "${MESH44_DEVKB_SWEEP:-}" ]] && exit 0

command -v jq >/dev/null 2>&1 || exit 0

input="$(cat)"
source="$(printf '%s' "$input" | jq -r '.source // empty' 2>/dev/null)"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)"

# Inject only on a genuine new session — not resume/clear/compact/fork.
[[ "$source" == "startup" ]] || exit 0

# --- mode + vault from config ---
config="$HOME/.config/mesh44/config.json"
mode="index"; vault=""; folder="devkb"
if [[ -f "$config" ]]; then
  m="$(jq -r '.obsidian.load_on_startup // empty' "$config" 2>/dev/null)"
  [[ -n "$m" ]] && mode="$m"
  vault="$(jq -r '.obsidian.vault // empty' "$config" 2>/dev/null)"
  cfg_dir="$(jq -r '.obsidian.folder // empty' "$config" 2>/dev/null)"
  [[ -n "$cfg_dir" ]] && folder="$cfg_dir"
fi
[[ "$mode" == "off" ]] && exit 0
[[ -z "$vault" ]] && vault="$HOME/Documents/Obsidian Vault"
vault="${vault/#\~/$HOME}"; vault="${vault//\$HOME/$HOME}"
root="$vault/$folder"
[[ -d "$root" ]] || exit 0

# Derive a clean project slug from cwd: www.mesh44.com -> mesh44.
project="$(basename "${cwd:-}")"
project="${project#www.}"
for tld in .com .net .org .io .dev .co .app .ai .xyz .sh .me; do project="${project%$tld}"; done
[[ -z "$project" ]] && project="misc"

# --- extract title / summary / tags from one note ---
note_meta() {
  awk '
    BEGIN { fm=0; started=0; title=""; summ=""; tags=""; refs="" }
    NR==1 && $0=="---" { fm=1; started=1; next }
    started==1 && fm==1 && $0=="---" { fm=0; next }
    fm==1 {
      if ($0 ~ /^tags:/)       { t=$0; sub(/^tags:[ \t]*/,"",t); tags=t }
      else if ($0 ~ /^references:/) { r=$0; sub(/^references:[ \t]*/,"",r); refs=r }
      next
    }
    title=="" && $0 ~ /^# / { t=$0; sub(/^# +/,"",t); title=t; next }
    summ=="" && $0 !~ /^#/ && $0 ~ /[^[:space:]]/ { summ=$0 }
    END { gsub(/\t/," ",title); gsub(/\t/," ",summ); gsub(/\t/," ",tags); gsub(/\t/," ",refs);
          print title "\t" summ "\t" tags "\t" refs }
  ' "$1" 2>/dev/null
}

body=""; len=0; total=0; shown=0; overflow=0

# scan_dir <relative-subpath> — index every note in <root>/<subpath>, newest
# first, appending a section to $body while there's room under the cap.
scan_dir() {
  local sub="$1" dir="$root/$1" heading="$2"
  [[ -d "$dir" ]] || return 0
  local section="" any=0 f base title summ tags line extra fbody chunk
  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    base="$(basename "$f")"
    [[ "$base" == "Session Inbox.md" ]] && continue
    total=$((total + 1))
    (( overflow )) && continue

    IFS=$'\t' read -r title summ tags refs < <(note_meta "$f")
    [[ -z "$title" ]] && title="${base%.md}"
    [[ ${#summ} -gt 160 ]] && summ="${summ:0:157}…"

    line="- **${title}**"
    [[ "$refs" =~ ^[0-9]+$ ]] && (( refs > 0 )) && line="$line ⟳${refs}"
    [[ -n "$summ" ]] && line="$line — ${summ}"
    line="$line  \`${folder}/${sub}/${base}\`"
    [[ -n "$tags" ]] && line="$line · ${tags}"
    line="$line"$'\n'

    extra=""
    if [[ "$mode" == "full" ]]; then
      fbody="$(awk 'BEGIN{fm=0;s=0} NR==1&&$0=="---"{fm=1;s=1;next} s==1&&fm==1&&$0=="---"{fm=0;next} fm==0{print}' "$f" 2>/dev/null)"
      extra="  \`\`\`"$'\n'"${fbody}"$'\n'"  \`\`\`"$'\n'
    fi

    chunk="${line}${extra}"
    if (( len + ${#chunk} > CAP )); then overflow=1; continue; fi
    section="${section}${chunk}"
    len=$((len + ${#chunk}))
    shown=$((shown + 1)); any=1
  done < <(ls -t "$dir"/*.md 2>/dev/null)

  if (( any )); then
    body="${body}## ${heading}"$'\n'"${section}"$'\n'
  fi
}

scan_dir "$project" "Project: ${project}"
scan_dir "general_learnings" "General learnings"

[[ "$shown" -eq 0 ]] && exit 0

# --- current project's inbox (untriaged), appended if there's room ---
inbox_block=""
inbox="$root/$project/Session Inbox.md"
if [[ -f "$inbox" ]]; then
  inbox_bullets="$(grep -E '^- ' "$inbox" 2>/dev/null | tail -8)"
  if [[ -n "$inbox_bullets" ]]; then
    inbox_block="## ${project} — session inbox (untriaged, promote with /devkb:capture)"$'\n'"${inbox_bullets}"$'\n'
    if (( len + ${#inbox_block} > CAP )); then inbox_block=""; fi
  fi
fi

more=""
(( overflow )) && more=" (+$((total - shown)) more not shown — ask to list them)"

header="# devkb — knowledge base for \`${project}\`"$'\n\n'
header+="${shown} of ${total} note(s) below${more}, newest first — from \`${folder}/${project}/\` and \`${folder}/general_learnings/\`. These are titles + summaries; open a note by its path when it's relevant to the work."$'\n\n'

context="${header}${body}${inbox_block}"

jq -n --arg ctx "$context" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $ctx
  }
}'
exit 0
