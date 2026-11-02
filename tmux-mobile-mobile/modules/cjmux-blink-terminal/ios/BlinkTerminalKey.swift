import UIKit

enum BlinkTerminalKey {
  static func sequence(for key: String) -> String? {
    switch key.lowercased() {
    case "escape", "esc":
      return "\u{1B}"
    case "tab":
      return "\t"
    case "enter", "return":
      return "\r"
    case "backspace", "bspace":
      return "\u{7F}"
    case "arrowup", "up":
      return "\u{1B}[A"
    case "arrowdown", "down":
      return "\u{1B}[B"
    case "arrowright", "right":
      return "\u{1B}[C"
    case "arrowleft", "left":
      return "\u{1B}[D"
    case "home":
      return "\u{1B}[H"
    case "end":
      return "\u{1B}[F"
    case "pageup":
      return "\u{1B}[5~"
    case "pagedown":
      return "\u{1B}[6~"
    case "delete":
      return "\u{1B}[3~"
    default:
      if key.lowercased().hasPrefix("ctrl+"),
         let scalar = key.dropFirst(5).uppercased().unicodeScalars.first,
         scalar.value >= 64,
         scalar.value <= 95,
         let control = UnicodeScalar(scalar.value - 64) {
        return String(Character(control))
      }
      return nil
    }
  }
}
