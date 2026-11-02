#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$root/dist}"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) platform=darwin-arm64; target=aarch64-apple-darwin ;;
  Linux-x86_64) platform=linux-x86_64; target=x86_64-unknown-linux-musl ;;
  *) printf 'Unsupported build platform: %s\n' "$(uname -sm)" >&2; exit 1 ;;
esac
command -v cargo >/dev/null
command -v node >/dev/null
mkdir -p "$out"
out="$(cd "$out" && pwd)"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
cargo test --locked --manifest-path "$root/tmux-jump/Cargo.toml" --bin tmux-jump --target "$target"
cargo build --locked --release --manifest-path "$root/tmux-jump/Cargo.toml" --bin tmux-jump --target "$target"
node "$root/tmux-jump/scripts/tmax-activity.test.mjs"
node "$root/scripts/build-activity.mjs" "$stage/tmax-activity.cjs"
artifacts="${CARGO_TARGET_DIR:-$root/tmux-jump/target}"
cp "$artifacts/$target/release/tmux-jump" "$stage/tmux-jump"
cp "$root/tmux-jump/README.md" "$stage/README.md"
cp "$root/THIRD_PARTY_NOTICES.md" "$stage/THIRD_PARTY_NOTICES.md"
python3 "$root/scripts/collect-licenses.py" "$stage/licenses"
cp "$root/tmux-mobile/node_modules/ws/LICENSE" "$stage/licenses/ws-LICENSE"
cp "$root/scripts/install-jump-archive.sh" "$stage/install.sh"
chmod 755 "$stage/tmux-jump" "$stage/install.sh"
tar -czf "$out/tmux-jump-$platform.tar.gz" -C "$stage" .
printf 'Built %s\n' "$out/tmux-jump-$platform.tar.gz"
