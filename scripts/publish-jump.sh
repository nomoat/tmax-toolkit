#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
tag="${1:?Usage: publish-jump.sh <tag>}"
repo="${TMAX_TOOLKIT_REPO:-nomoat/tmax-toolkit}"
cd "$root"
test -z "$(git status --porcelain)" || { echo 'Commit reviewed source before publishing.' >&2; exit 1; }
test -f dist/tmux-jump-darwin-arm64.tar.gz
test -f dist/tmux-jump-linux-x86_64.tar.gz
if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  echo "Release $tag already exists; choose a new tag." >&2; exit 1
fi
(
  cd dist
  if command -v sha256sum >/dev/null; then
    sha256sum tmux-jump-darwin-arm64.tar.gz tmux-jump-linux-x86_64.tar.gz > SHA256SUMS
  else
    shasum -a 256 tmux-jump-darwin-arm64.tar.gz tmux-jump-linux-x86_64.tar.gz > SHA256SUMS
  fi
)
notes="$(mktemp)"
trap 'rm -f "$notes"' EXIT
cat > "$notes" <<'NOTES'
Local tmux picker: activity timestamps, session/recent sorting (`s`), and name search (`/` or Ctrl-f).

Archives include the activity reader. Requires tmux and Node.js 20+; no Rust compiler or source checkout is needed. Extract the matching archive and run `bash install.sh`. SHA256SUMS covers both archives.

macOS: Apple Silicon. Linux: x86_64 static musl. Built and tested on their respective platforms; publication starts no CI jobs.
NOTES
gh release create "$tag" --repo "$repo" --target "$(git rev-parse HEAD)" \
  --title "$tag" --notes-file "$notes" \
  dist/tmux-jump-darwin-arm64.tar.gz dist/tmux-jump-linux-x86_64.tar.gz dist/SHA256SUMS
