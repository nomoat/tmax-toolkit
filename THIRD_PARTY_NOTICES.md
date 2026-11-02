# Third-party notices

Existing license and attribution files are retained in their component trees.
The mobile client retains its MIT license in `tmux-mobile-mobile/LICENSE`;
this does not replace licenses for its embedded components.

- Blink is pinned as a Git submodule. Its licensing applies to the Blink
  integration and redistributed resources/frameworks; see `vendor/blink` and
  `tmux-mobile-mobile/modules/cjmux-blink-terminal/ios/Resources/Blink-COPYING`.
- Shared card actions retain `public/card-actions.LICENSE` and the mobile copy.
- The PR Lens reference retains its bundled LICENSE in the Drafts Skill.
- Audio assets retain `tmux-mobile/public/sounds/CREDITS.md`.
- The standalone picker activity helper bundles `ws` (MIT); its license is
  included in picker release archives. Node.js is an external prerequisite.
- Picker Rust dependency versions are recorded in `tmux-jump/Cargo.lock`.

No new blanket license is assigned to the imported source snapshots. Refer to
the applicable component and third-party notices.
