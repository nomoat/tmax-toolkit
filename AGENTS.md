# T-MAX Toolkit

This monorepo contains three independently runnable components:

- `tmux-mobile/`: hosted Controller, machine Connector, Web UI and MCP.
- `tmux-mobile-mobile/`: React Native client. Use the Controller API; do not
  implement machine execution or Connector transports in the mobile client.
- `tmux-jump/`: Rust terminal session/window picker. The tmux binary lives in
  `src/bin/tmux-jump.rs`; the separate RMUX binary lives in `src/main.rs`.

This repository is the active development source for all three components.
Legacy standalone checkouts may be kept in a workspace-level `backup/`
directory for recovery. Do not edit or build from those archives, and do not
link dependencies or runtime files into them. Keep each component's development
dependencies inside this repository. `CLAUDE.md` links to these instructions.

Keep sibling paths stable: mobile parity scripts and the picker activity reader
reuse the Web component's code. Preserve third-party notices and the Blink
submodule revision. Do not edit generated copies of shared frontend modules.

Publishing source, publishing picker archives, deploying the Controller and
publishing mobile apps are separate operations. Ordinary pushes do not build
or deploy anything. Binary releases are explicit, using `scripts/build-jump.sh`
on each target platform and `scripts/publish-jump.sh` after checks.

Keep credentials, signing keys, private operational notes and machine-specific
configuration out of the repository and release archives. The Controller's
checked-in access policy is an example; use a private policy for a real service.
T-MAX Skills remain under `tmux-mobile/public/skills/`; preserve their manifests
and use the existing build/test commands when changing them.

Run focused tests for changed components. For the picker, use
`cargo test --manifest-path tmux-jump/Cargo.toml --bin tmux-jump` and
`node tmux-jump/scripts/tmax-activity.test.mjs`.
