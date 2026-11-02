# jump

A small Rust TUI for jumping across multiplexer sessions or windows.

This repo builds two backend-specific binaries:

- `rmux-jump`: talks to the RMUX daemon through the Rust SDK and typed protocol requests.
- `tmux-jump`: talks to tmux through the tmux CLI.

## tmux activity time and sorting

`tmux-jump` shows each window's last activity in the list (`2m ago`, `3h ago`),
and its full local date/time in Preview. Session headers show the newest time
among their windows. Press **s** to toggle between session groups and a flat
list of all windows, newest activity first. The selected window stays selected
when the order or timestamps change. Your choice is saved in
`~/.config/tmux-jump/sort` (honoring `XDG_CONFIG_HOME`). Override it for one launch
with `--sort session` or `--sort recent`; these also apply to `--list`.

Agent times use the same local transcript readers and `latestActivityTime`
function as T-MAX Command Center: the latest valid timestamp among the last
turn, last user message and last assistant message. Unknown conversation times
show `—` and sort last. Ordinary shells use tmux's window activity timestamp,
marked `~` to distinguish terminal activity from a conversation message.

Release archives include a standalone activity helper and require only Node.js
20+ and tmux on the destination. Source builds can use the neighboring
`tmux-mobile` checkout with its Node dependencies installed. Set
`TMUX_JUMP_TMAX_DIR` to use another checkout. The reader runs only while the
picker is open; it reads times asynchronously and never sends input to an agent.
If it is unavailable, the picker still works with marked terminal timestamps.

Press **/** or **Ctrl-f** to search by session/window name. Matching ignores case;
multiple words must all match. Type to filter, use **↑/↓** to choose a match,
then **Enter** to switch. **Esc** clears the search; **Ctrl-u** erases the query.
Printable keys such as `j`, `s` and `x` are text while search is active.

Validate with `cargo test --bin tmux-jump` and
`node scripts/tmax-activity.test.mjs`; build with
`cargo build --release --bin tmux-jump`. These features apply to the tmux binary;
the RMUX picker is unchanged.

## Usage

```sh
cargo run --release --bin rmux-jump -- --all-windows
cargo run --release --bin tmux-jump -- --all-windows
```

Controls:

- `j` / `k` (or `↑` / `↓`): move through every window of every session in one flat list (wraps around)
- `h` / `l` (or `←` / `→`, `Tab` / `Shift-Tab`): jump to the previous / next session
- `Enter`: switch to the selected RMUX window
- `$`: rename the selected session (Enter saves, Esc cancels)
- `,`: rename the selected window (Enter saves, Esc cancels)
- `x`: kill the selected window (`y` confirms, `n` / `Esc` cancels)
- `X`: kill the selected session (`y` confirms, `n` / `Esc` cancels)
- `r`: refresh now
- `/` / `Ctrl-f`: search names (tmux picker)
- `s`: toggle session / recent activity order (tmux picker)
- `q` / `Esc`: quit

The picker lists every RMUX window in one vertical list, grouped under a header
for each session. `j` / `k` walk through the whole list (crossing session
boundaries and wrapping at the ends), while `h` / `l` jump straight to the
previous / next session's active window. The picker refreshes preview output
every 5 seconds while it is open.
`--all-windows` only affects the `--list` printout (it makes `--list` enumerate
every window instead of just each session's active window); the interactive
picker always shows the grouped view.

Useful options:

```sh
rmux-jump --preview-lines 12
rmux-jump --window-lines 10
rmux-jump --refresh-seconds 0
rmux-jump --list --all-windows
```

`--window-lines 10` is a shortcut for showing every RMUX window with the last
ten visible pane lines from the SDK snapshot in the right preview pane.
Use `--refresh-seconds 0` to disable automatic refresh.
When a pane's current directory is inside a Git worktree, `rmux-jump` shows a
compact worktree summary in the list and full Git details in the preview pane.

## Agent-session rename hook

Renaming a window can optionally notify an external script, which is the safe
place to integrate a particular Codex or Claude Code version. Set
`TMUX_JUMP_WINDOW_RENAME_HOOK` to a shell command; it runs only after a window
rename succeeds and never blocks or rolls back the RMUX/tmux rename.

The hook receives `TMUX_JUMP_BACKEND`, `TMUX_JUMP_SESSION_ID`,
`TMUX_JUMP_SESSION_NAME`, `TMUX_JUMP_WINDOW_ID`, `TMUX_JUMP_WINDOW_INDEX`,
`TMUX_JUMP_OLD_WINDOW_NAME`, `TMUX_JUMP_WINDOW_NAME`, `TMUX_JUMP_PANE_ID`, and
`TMUX_JUMP_PANE_PATH`. For example:

```sh
export TMUX_JUMP_WINDOW_RENAME_HOOK="$HOME/.local/bin/sync-agent-title"
```

Use this as a one-way event (window name → agent title), not a continuously
running or bidirectional sync: a multiplexer session can contain several agent
windows, so a session-wide mirror would otherwise be ambiguous. The hook should
detect the agent for the supplied pane and use that agent's supported title API;
do not edit Codex or Claude Code session files directly.

## Install

```sh
cargo install --path . --bins --force
```

## RMUX binding

Put one of these in `~/.rmux.conf` or `~/.config/rmux/rmux.conf`, then run
`rmux source-file ~/.rmux.conf`.

Recommended shortcut:

- `prefix + j` opens the all-window picker.
- With RMUX's default prefix, press `Control-B`, then `j`.

Prefix key session picker:

```rmux
bind-key j display-popup -E -w 90% -h 85% "rmux-jump"
```

Prefix key window picker:

```rmux
bind-key j display-popup -E -w 90% -h 85% "rmux-jump --window-lines 10"
```

No-prefix window picker on `Ctrl-Space`:

```rmux
bind-key -n C-Space display-popup -E -w 90% -h 85% "rmux-jump --window-lines 10"
bind-key -n C-@ display-popup -E -w 90% -h 85% "rmux-jump --window-lines 10"
bind-key -n M-Space display-popup -E -w 90% -h 85% "rmux-jump --window-lines 10"
```

To apply the window picker immediately:

```sh
rmux bind-key j display-popup -E -w 90% -h 85% "rmux-jump --window-lines 10"
rmux bind-key -n C-Space display-popup -E -w 90% -h 85% "rmux-jump --window-lines 10"
rmux bind-key -n C-@ display-popup -E -w 90% -h 85% "rmux-jump --window-lines 10"
rmux bind-key -n M-Space display-popup -E -w 90% -h 85% "rmux-jump --window-lines 10"
```

## tmux binding

Put one of these in `~/.tmux.conf` or `~/.config/tmux/tmux.conf`, then run
`tmux source-file ~/.tmux.conf`.

```tmux
bind-key j display-popup -E -w 90% -h 85% "tmux-jump --window-lines 10"
bind-key -n C-Space display-popup -E -w 90% -h 85% "tmux-jump --window-lines 10"
```
