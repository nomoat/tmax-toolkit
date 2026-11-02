import ExpoModulesCore
import UIKit

final class CJMUXBlinkTerminalView: ExpoView {
  let onReady = EventDispatcher()
  let onStateChange = EventDispatcher()
  let onHostKeyPrompt = EventDispatcher()
  let onExit = EventDispatcher()

  var pendingConfiguration = BlinkTerminalConfiguration()
  var autoFocus = true

  var colorScheme = "dark" {
    didSet {
      terminalSurface.colorScheme = colorScheme
    }
  }

  var fontSize = 14.0 {
    didSet {
      terminalSurface.fontSize = fontSize
    }
  }

  private let terminalSurface = BlinkTerminalSurface()
  private var committedConfiguration = BlinkTerminalConfiguration()
  private var session: BlinkSSHSession?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    backgroundColor = UIColor(red: 16 / 255, green: 16 / 255, blue: 16 / 255, alpha: 1)
    clipsToBounds = true

    terminalSurface.translatesAutoresizingMaskIntoConstraints = false
    addSubview(terminalSurface)
    NSLayoutConstraint.activate([
      terminalSurface.topAnchor.constraint(equalTo: topAnchor),
      terminalSurface.leadingAnchor.constraint(equalTo: leadingAnchor),
      terminalSurface.trailingAnchor.constraint(equalTo: trailingAnchor),
      terminalSurface.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])

    terminalSurface.onReady = { [weak self] rows, columns in
      guard let self else { return }
      self.session?.resize(rows: rows, columns: columns)
      self.onReady([:])
      if self.autoFocus {
        self.terminalSurface.focus()
      }
    }

    terminalSurface.onInput = { [weak self] data in
      self?.session?.send(data)
    }

    terminalSurface.onResize = { [weak self] rows, columns in
      self?.session?.resize(rows: rows, columns: columns)
    }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil, autoFocus {
      terminalSurface.focus()
    }
  }

  func commitConfiguration() {
    terminalSurface.colorScheme = colorScheme
    terminalSurface.fontSize = fontSize

    guard pendingConfiguration.isValid else {
      return
    }

    guard pendingConfiguration != committedConfiguration else {
      return
    }

    committedConfiguration = pendingConfiguration
    connect()
  }

  func focus() {
    terminalSurface.focus()
  }

  func blur() {
    terminalSurface.blur()
  }

  func reconnect() {
    connect()
  }

  func disconnect() {
    session?.disconnect()
    session = nil
  }

  func approveHostKey(_ accepted: Bool) {
    session?.approveHostKey(accepted)
  }

  func sendText(_ text: String, submit: Bool) {
    var data = Data(text.utf8)
    if submit {
      data.append(0x0D)
    }
    session?.send(data)
  }

  func sendKey(_ key: String) {
    guard let sequence = BlinkTerminalKey.sequence(for: key) else {
      return
    }
    session?.send(Data(sequence.utf8))
  }

  func paste() {
    guard let text = UIPasteboard.general.string, !text.isEmpty else {
      return
    }
    terminalSurface.paste(text)
  }

  private func connect() {
    session?.disconnect()
    terminalSurface.reset()
    publishState("connecting", message: "Connecting to \(committedConfiguration.host)…")

    let nextSession = BlinkSSHSession(
      configuration: committedConfiguration,
      rows: terminalSurface.rows,
      columns: terminalSurface.columns
    )
    session = nextSession

    nextSession.onOutput = { [weak self, weak nextSession] data in
      guard let self, let nextSession, self.session === nextSession else { return }
      self.terminalSurface.write(data)
    }

    nextSession.onStateChange = { [weak self, weak nextSession] state, message in
      guard let self, let nextSession, self.session === nextSession else { return }
      self.publishState(state, message: message)
    }

    nextSession.onHostKeyPrompt = { [weak self, weak nextSession] fingerprint, changed in
      guard let self, let nextSession, self.session === nextSession else { return }
      self.onHostKeyPrompt([
        "fingerprint": fingerprint,
        "changed": changed,
      ])
    }

    nextSession.onExit = { [weak self, weak nextSession] reason in
      guard let self, let nextSession, self.session === nextSession else { return }
      self.onExit(["reason": reason])
    }

    nextSession.connect()
  }

  private func publishState(_ state: String, message: String? = nil) {
    var payload: [String: Any] = ["state": state]
    if let message, !message.isEmpty {
      payload["message"] = message
    }
    onStateChange(payload)
  }

  deinit {
    session?.disconnect()
    terminalSurface.terminate()
  }
}
