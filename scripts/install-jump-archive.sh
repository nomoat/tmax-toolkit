#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
prefix="${1:-$HOME/.local}"
command -v node >/dev/null || { echo 'Node.js 20+ is required.' >&2; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<20)process.exit(1)' || { echo 'Node.js 20+ is required.' >&2; exit 1; }
command -v tmux >/dev/null || { echo 'tmux is required.' >&2; exit 1; }
test -f "$here/tmux-jump"
test -f "$here/tmax-activity.cjs"
"$here/tmux-jump" --help >/dev/null
mkdir -p "$prefix/bin" "$prefix/lib/tmux-jump"
if test -e "$prefix/bin/tmux-jump"; then
  backup="$prefix/share/tmux-jump/backups/$(date -u +%Y%m%dT%H%M%SZ)-$$"
  mkdir -p "$backup"
  cp -p "$prefix/bin/tmux-jump" "$backup/tmux-jump"
  if test -f "$prefix/lib/tmux-jump/tmax-activity.cjs"; then
    cp -p "$prefix/lib/tmux-jump/tmax-activity.cjs" "$backup/tmax-activity.cjs"
  fi
  printf 'Previous version: %s\n' "$backup"
fi
install -m 644 "$here/tmax-activity.cjs" "$prefix/lib/tmux-jump/.activity-new-$$"
install -m 755 "$here/tmux-jump" "$prefix/bin/.tmux-jump-new-$$"
mv -f "$prefix/lib/tmux-jump/.activity-new-$$" "$prefix/lib/tmux-jump/tmax-activity.cjs"
mv -f "$prefix/bin/.tmux-jump-new-$$" "$prefix/bin/tmux-jump"
printf 'Installed %s/bin/tmux-jump\n' "$prefix"
