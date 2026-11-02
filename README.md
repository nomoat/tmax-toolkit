# T-MAX Toolkit

The essential tools for using coding agents across machines and terminals.

| Component | Purpose |
| --- | --- |
| [tmux-mobile](tmux-mobile/) | Controller, Connector, Web Command Center and MCP |
| [tmux-mobile-mobile](tmux-mobile-mobile/) | iOS / Android React Native client |
| [tmux-jump](tmux-jump/) | Local tmux window picker with previews, activity times, sorting and search |

These are source snapshots of the three existing repositories, including the
picker's current local work. `PROVENANCE.json` records their original revisions.
The original repositories remain available for their prior history.

## Install the picker

Prebuilt archives are available on [Releases](https://github.com/nomoat/tmax-toolkit/releases):

- macOS Apple Silicon: `tmux-jump-darwin-arm64.tar.gz`
- Linux x86_64: `tmux-jump-linux-x86_64.tar.gz` (static musl binary)

Requires tmux and Node.js 20+. No Rust compiler, npm install or source checkout
is needed on the destination machine. The archive includes the same T-MAX
activity reader used by the Web component, bundled for local execution.

```sh
curl -fsSL https://raw.githubusercontent.com/nomoat/tmax-toolkit/main/scripts/install-jump.sh -o /tmp/install-tmux-jump.sh
bash /tmp/install-tmux-jump.sh
```

The installer selects the platform, verifies SHA-256, and installs into
`~/.local/bin` and `~/.local/lib/tmux-jump`. Existing versions are backed up.
For a downloaded and verified archive, extract it and run `bash install.sh`.
An optional first argument changes the installation prefix.

Add to your tmux configuration:

```tmux
bind-key j display-popup -E -w 90% -h 85% "$HOME/.local/bin/tmux-jump --window-lines 10"
bind-key -n C-Space display-popup -E -w 90% -h 85% "$HOME/.local/bin/tmux-jump --window-lines 10"
```

Use **Ctrl-Space** or **Ctrl-b, j** to open. **s** toggles session groups / newest
activity first and remembers your choice. **/** (or **Ctrl-f**) enters search;
type a session/window name, use **↑/↓**, then **Enter** to switch. **Esc** clears
search, **Ctrl-u** erases the query. Matching ignores case and supports multiple
words. A `~` time comes from terminal activity; `—` means no known conversation
time. Preview shows the full local date/time.

## Develop

Clone recursively when working on the native Blink integration:

```sh
git clone --recurse-submodules https://github.com/nomoat/tmax-toolkit.git
cd tmax-toolkit
npm ci --prefix tmux-mobile
cargo test --manifest-path tmux-jump/Cargo.toml --bin tmux-jump
node tmux-jump/scripts/tmax-activity.test.mjs
```

Web/Connector commands run from `tmux-mobile/`; mobile commands run from
`tmux-mobile-mobile/`. Existing sibling paths and lockfiles are preserved.
The checked-in Controller access policy is an example. Configure your own
policy and OAuth/service credentials privately before self-hosting.
Optional WeType speech requires `WETYPE_SIGN_KEY` and `WETYPE_HANDSHAKE_KEY`;
credentials are not included. Private operation notes and local machine data
were not imported. See [third-party notices](THIRD_PARTY_NOTICES.md).

## Small, manual releases

There are no scheduled or push-triggered builds, deployments or releases.
Push ordinary source changes whenever needed. Only build a new picker archive
when you want to distribute a new binary.

On each target machine, with Rust, Node and tmux available:

```sh
npm ci --prefix tmux-mobile
# Linux only: install musl-tools, then:
rustup target add x86_64-unknown-linux-musl
bash scripts/build-jump.sh
```

On macOS, the build uses the native Apple Silicon toolchain. On Linux it uses
musl and runs the tests for that target. Bring both `.tar.gz` archives into one
`dist/` directory, then publish once:

```sh
bash scripts/publish-jump.sh jump-v0.2.0
```

This creates a checksummed GitHub Release from already-built artifacts. It does
not start hosted CI, change the Controller or publish mobile apps.
