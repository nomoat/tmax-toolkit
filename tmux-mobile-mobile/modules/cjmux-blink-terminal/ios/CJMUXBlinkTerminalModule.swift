import ExpoModulesCore

public final class CJMUXBlinkTerminalModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CJMUXBlinkTerminal")

    AsyncFunction("ensureManagedIdentity") {
      (installMarker: String?) -> [String: String] in
      try BlinkSSHIdentity.ensureManagedIdentity(
        installMarker: installMarker
      ).dictionary
    }

    View(CJMUXBlinkTerminalView.self) {
      Events(
        "onReady",
        "onStateChange",
        "onHostKeyPrompt",
        "onExit"
      )

      Prop("host") { (view, value: String) in
        view.pendingConfiguration.host = value
      }

      Prop("user") { (view, value: String) in
        view.pendingConfiguration.user = value
      }

      Prop("port") { (view, value: Int) in
        view.pendingConfiguration.port = value
      }

      Prop("password") { (view, value: String?) in
        view.pendingConfiguration.password = value ?? ""
      }

      Prop("privateKey") { (view, value: String?) in
        view.pendingConfiguration.privateKey = value ?? ""
      }

      Prop("identityId") { (view, value: String?) in
        view.pendingConfiguration.identityId = value ?? ""
      }

      Prop("command") { (view, value: String?) in
        view.pendingConfiguration.command = value ?? ""
      }

      Prop("connectionKey") { (view, value: String) in
        view.pendingConfiguration.connectionKey = value
      }

      Prop("autoFocus") { (view, value: Bool) in
        view.autoFocus = value
      }

      Prop("colorScheme") { (view, value: String) in
        view.colorScheme = value
      }

      Prop("fontSize") { (view, value: Double) in
        view.fontSize = value
      }

      OnViewDidUpdateProps { view in
        view.commitConfiguration()
      }

      AsyncFunction("focus") { (view: CJMUXBlinkTerminalView) in
        view.focus()
      }

      AsyncFunction("blur") { (view: CJMUXBlinkTerminalView) in
        view.blur()
      }

      AsyncFunction("reconnect") { (view: CJMUXBlinkTerminalView) in
        view.reconnect()
      }

      AsyncFunction("disconnect") { (view: CJMUXBlinkTerminalView) in
        view.disconnect()
      }

      AsyncFunction("approveHostKey") { (view: CJMUXBlinkTerminalView, accepted: Bool) in
        view.approveHostKey(accepted)
      }

      AsyncFunction("sendText") {
        (view: CJMUXBlinkTerminalView, text: String, submit: Bool) in
        view.sendText(text, submit: submit)
      }

      AsyncFunction("sendKey") { (view: CJMUXBlinkTerminalView, key: String) in
        view.sendKey(key)
      }

      AsyncFunction("paste") { (view: CJMUXBlinkTerminalView) in
        view.paste()
      }
    }
  }
}
