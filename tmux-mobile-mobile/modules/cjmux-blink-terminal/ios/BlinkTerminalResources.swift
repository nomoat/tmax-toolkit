import Foundation

enum BlinkTerminalResources {
  static var bundle: Bundle? {
    let candidates = [
      Bundle.main.url(
        forResource: "CJMUXBlinkTerminalResources",
        withExtension: "bundle"
      ),
      Bundle(for: BundleToken.self).url(
        forResource: "CJMUXBlinkTerminalResources",
        withExtension: "bundle"
      ),
    ]

    for candidate in candidates {
      if let candidate, let bundle = Bundle(url: candidate) {
        return bundle
      }
    }
    return nil
  }

  private final class BundleToken {}
}
