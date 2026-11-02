import ExpoModulesCore
import Foundation

public class CJMUXVisionDeviceModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CJMUXVisionDevice")

    Constant("isIOSAppOnVision") { () -> Bool? in
      if #available(iOS 26.1, *) {
        return ProcessInfo.processInfo.isiOSAppOnVision
      }
      return nil
    }
  }
}
