#!/usr/bin/env bash
set -euo pipefail
repo="${TMAX_TOOLKIT_REPO:-nomoat/tmax-toolkit}"
release="${TMAX_TOOLKIT_RELEASE:-latest}"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) platform=darwin-arm64 ;;
  Linux-x86_64) platform=linux-x86_64 ;;
  *) echo "No prebuilt picker for $(uname -sm)" >&2; exit 1 ;;
esac
case "$release" in
  latest) base="https://github.com/$repo/releases/latest/download" ;;
  *) base="https://github.com/$repo/releases/download/$release" ;;
esac
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
archive="tmux-jump-$platform.tar.gz"
curl -fLsS "$base/$archive" -o "$work/$archive"
curl -fLsS "$base/SHA256SUMS" -o "$work/SHA256SUMS"
expected="$(awk -v name="$archive" '$2==name { print $1 }' "$work/SHA256SUMS")"
if command -v sha256sum >/dev/null; then
  actual="$(sha256sum "$work/$archive" | awk '{print $1}')"
else
  actual="$(shasum -a 256 "$work/$archive" | awk '{print $1}')"
fi
test -n "$expected" && test "$expected" = "$actual" || { echo 'Archive checksum mismatch' >&2; exit 1; }
mkdir "$work/unpacked"
tar -xzf "$work/$archive" -C "$work/unpacked"
bash "$work/unpacked/install.sh" "${1:-$HOME/.local}"
