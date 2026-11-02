import ExpoModulesCore
import UIKit

private enum ShortcutMode: String {
  case all
  case escape
  case none
}

private struct ShortcutKey {
  let input: String
  let key: String
}

public final class CJMUXKeyboardShortcutsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CJMUXKeyboardShortcuts")

    View(CJMUXKeyboardShortcutView.self) {
      Events("onKeyDown")

      Prop("mode") { (view, value: String) in
        view.setMode(value)
      }
    }
  }
}

private final class CJMUXKeyboardShortcutView: ExpoView {
  let onKeyDown = EventDispatcher()

  private var shortcutMode = ShortcutMode.none

  private static let cardShortcutKeys = [
    ShortcutKey(input: UIKeyCommand.inputLeftArrow, key: "ArrowLeft"),
    ShortcutKey(input: UIKeyCommand.inputRightArrow, key: "ArrowRight"),
    ShortcutKey(input: UIKeyCommand.inputUpArrow, key: "ArrowUp"),
    ShortcutKey(input: UIKeyCommand.inputDownArrow, key: "ArrowDown"),
    ShortcutKey(input: "h", key: "h"),
    ShortcutKey(input: "j", key: "j"),
    ShortcutKey(input: "k", key: "k"),
    ShortcutKey(input: "l", key: "l"),
    ShortcutKey(input: "u", key: "u"),
    ShortcutKey(input: "r", key: "r"),
    ShortcutKey(input: "i", key: "i"),
    ShortcutKey(input: "s", key: "s"),
    ShortcutKey(input: "o", key: "o"),
    ShortcutKey(input: "f", key: "f"),
    ShortcutKey(input: "t", key: "t"),
  ]

  override var canBecomeFirstResponder: Bool {
    shortcutMode != .none
  }

  override var keyCommands: [UIKeyCommand]? {
    switch shortcutMode {
    case .none:
      return nil
    case .escape:
      return commands(for: [ShortcutKey(input: UIKeyCommand.inputEscape, key: "Escape")])
    case .all:
      return commands(
        for: Self.cardShortcutKeys + [ShortcutKey(input: UIKeyCommand.inputEscape, key: "Escape")]
      ) + searchCommands()
    }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    requestFocusIfNeeded()
  }

  func setMode(_ value: String) {
    let nextMode = ShortcutMode(rawValue: value) ?? .none
    guard shortcutMode != nextMode else {
      if nextMode == .all {
        requestFocusIfNeeded()
      }
      return
    }

    shortcutMode = nextMode

    if nextMode == .none {
      resignFirstResponder()
    } else if nextMode == .all {
      requestFocusIfNeeded()
    }
  }

  private func commands(for keys: [ShortcutKey]) -> [UIKeyCommand] {
    let modifierOptions: [UIKeyModifierFlags] = [[], .shift]
    return keys.flatMap { shortcut in
      modifierOptions.map { modifiers in
        let command = UIKeyCommand(
          input: shortcut.input,
          modifierFlags: modifiers,
          action: #selector(handleKeyCommand(_:))
        )
        command.wantsPriorityOverSystemBehavior = true
        return command
      }
    }
  }

  private func searchCommands() -> [UIKeyCommand] {
    let modifierOptions: [UIKeyModifierFlags] = [
      .command,
      .control,
      [.command, .control],
    ]
    return modifierOptions.map { modifiers in
      let command = UIKeyCommand(
        input: "k",
        modifierFlags: modifiers,
        action: #selector(handleKeyCommand(_:))
      )
      command.wantsPriorityOverSystemBehavior = true
      return command
    }
  }

  private func requestFocusIfNeeded() {
    guard shortcutMode == .all, window != nil else {
      return
    }
    DispatchQueue.main.async { [weak self] in
      guard let self, self.shortcutMode == .all, self.window != nil else {
        return
      }
      self.becomeFirstResponder()
    }
  }

  @objc
  private func handleKeyCommand(_ command: UIKeyCommand) {
    guard let input = command.input else {
      return
    }
    let key = Self.cardShortcutKeys.first(where: { $0.input == input })?.key
      ?? (input == UIKeyCommand.inputEscape ? "Escape" : input)
    let modifiers = command.modifierFlags

    onKeyDown([
      "key": key,
      "ctrlKey": modifiers.contains(.control),
      "metaKey": modifiers.contains(.command),
      "altKey": modifiers.contains(.alternate),
      "shiftKey": modifiers.contains(.shift),
      "repeat": false,
    ])
  }
}
