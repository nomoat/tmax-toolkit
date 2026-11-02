import UIKit
import WebKit

final class BlinkTerminalSurface: UIView, UIKeyInput, UITextInputTraits {
  private static let maxOutputChunkBytes = 256 * 1024
  private static let maxPendingOutputBytes = 4 * 1024 * 1024

  var onReady: ((Int32, Int32) -> Void)?
  var onInput: ((Data) -> Void)?
  var onResize: ((Int32, Int32) -> Void)?

  var colorScheme = "dark" {
    didSet {
      applyAppearance()
    }
  }

  var fontSize = 14.0 {
    didSet {
      applyAppearance()
    }
  }

  private(set) var rows: Int32 = 24
  private(set) var columns: Int32 = 80

  private var webView: WKWebView!
  private var terminalURL: URL?
  private var resourceBundleURL: URL?
  private var ready = false
  private var outputEvaluationInFlight = false
  private var terminalGeneration = 0
  private var pendingOutput = Data()
  private var outputFlushScheduled = false
  private let outputQueue = DispatchQueue(label: "ai.impo.cjmux.blink-terminal.output")

  override var canBecomeFirstResponder: Bool {
    true
  }

  var hasText: Bool {
    true
  }

  var autocapitalizationType: UITextAutocapitalizationType = .none
  var autocorrectionType: UITextAutocorrectionType = .no
  var spellCheckingType: UITextSpellCheckingType = .no
  var smartQuotesType: UITextSmartQuotesType = .no
  var smartDashesType: UITextSmartDashesType = .no
  var smartInsertDeleteType: UITextSmartInsertDeleteType = .no
  var keyboardType: UIKeyboardType = .asciiCapable
  var keyboardAppearance: UIKeyboardAppearance = .dark
  var returnKeyType: UIReturnKeyType = .default
  var enablesReturnKeyAutomatically = false
  var isSecureTextEntry = false
  var textContentType: UITextContentType!

  override var inputAccessoryView: UIView? {
    BlinkTerminalAccessoryView(
      onKey: { [weak self] key in
        guard let sequence = BlinkTerminalKey.sequence(for: key) else { return }
        self?.send(sequence)
      },
      onPaste: { [weak self] in
        guard let text = UIPasteboard.general.string else { return }
        self?.paste(text)
      }
    )
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    configureWebView()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    configureWebView()
  }

  func focus() {
    DispatchQueue.main.async { [weak self] in
      self?.becomeFirstResponder()
    }
  }

  func blur() {
    resignFirstResponder()
  }

  func reset() {
    terminalGeneration += 1
    ready = false
    outputEvaluationInFlight = false
    outputQueue.sync {
      pendingOutput.removeAll(keepingCapacity: true)
      outputFlushScheduled = false
    }
    loadTerminal()
  }

  func write(_ data: Data) {
    guard !data.isEmpty else { return }
    outputQueue.async { [weak self] in
      guard let self else { return }
      self.enqueueOutput(data)
      guard !self.outputFlushScheduled else { return }
      self.outputFlushScheduled = true
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.016) { [weak self] in
        self?.flushOutput()
      }
    }
  }

  func insertText(_ text: String) {
    send(text.replacingOccurrences(of: "\n", with: "\r"))
  }

  func deleteBackward() {
    send("\u{7F}")
  }

  func paste(_ text: String) {
    guard ready, !text.isEmpty else { return }
    guard
      let encoded = try? JSONEncoder().encode(text),
      let literal = String(data: encoded, encoding: .utf8)
    else {
      return
    }
    webView.evaluateJavaScript("term_paste(\(literal));")
  }

  func terminate() {
    blur()
    ready = false
    outputEvaluationInFlight = false
    webView?.stopLoading()
    webView?.navigationDelegate = nil
    let controller = webView?.configuration.userContentController
    controller?.removeScriptMessageHandler(forName: "interOp")
    controller?.removeScriptMessageHandler(forName: "_kb")
    onReady = nil
    onInput = nil
    onResize = nil
  }

  override var keyCommands: [UIKeyCommand]? {
    let simple: [(String, String)] = [
      (UIKeyCommand.inputEscape, "escape"),
      (UIKeyCommand.inputUpArrow, "arrowup"),
      (UIKeyCommand.inputDownArrow, "arrowdown"),
      (UIKeyCommand.inputLeftArrow, "arrowleft"),
      (UIKeyCommand.inputRightArrow, "arrowright"),
      ("\t", "tab"),
    ]

    var commands = simple.map { input, key in
      let command = UIKeyCommand(
        title: "",
        image: nil,
        action: #selector(handleKeyCommand(_:)),
        input: input,
        modifierFlags: [],
        propertyList: key
      )
      command.wantsPriorityOverSystemBehavior = true
      return command
    }

    for scalar in UnicodeScalar("A").value...UnicodeScalar("Z").value {
      guard let unicode = UnicodeScalar(scalar) else { continue }
      let input = String(Character(unicode)).lowercased()
      let command = UIKeyCommand(
        title: "",
        image: nil,
        action: #selector(handleKeyCommand(_:)),
        input: input,
        modifierFlags: .control,
        propertyList: "ctrl+\(input)"
      )
      command.wantsPriorityOverSystemBehavior = true
      commands.append(command)
    }

    return commands
  }

  @objc
  private func handleKeyCommand(_ command: UIKeyCommand) {
    guard
      let key = command.propertyList as? String,
      let sequence = BlinkTerminalKey.sequence(for: key)
    else {
      return
    }
    send(sequence)
  }

  private func configureWebView() {
    backgroundColor = UIColor(red: 16 / 255, green: 16 / 255, blue: 16 / 255, alpha: 1)

    let controller = WKUserContentController()
    controller.add(self, name: "interOp")
    controller.add(self, name: "_kb")

    let configuration = WKWebViewConfiguration()
    configuration.userContentController = controller
    configuration.defaultWebpagePreferences.preferredContentMode = .desktop
    if #available(iOS 18.0, *) {
      configuration.writingToolsBehavior = .none
    }

    webView = WKWebView(frame: bounds, configuration: configuration)
    webView.translatesAutoresizingMaskIntoConstraints = false
    webView.isOpaque = false
    webView.backgroundColor = backgroundColor
    webView.scrollView.backgroundColor = backgroundColor
    webView.scrollView.keyboardDismissMode = .interactive
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    webView.allowsLinkPreview = false
    webView.navigationDelegate = self
    addSubview(webView)

    NSLayoutConstraint.activate([
      webView.topAnchor.constraint(equalTo: topAnchor),
      webView.leadingAnchor.constraint(equalTo: leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: trailingAnchor),
      webView.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])

    let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap))
    tap.cancelsTouchesInView = false
    webView.addGestureRecognizer(tap)

    loadTerminal()
  }

  @objc
  private func handleTap() {
    focus()
  }

  private func loadTerminal() {
    guard
      let bundle = BlinkTerminalResources.bundle,
      let html = bundle.url(forResource: "term", withExtension: "html")
    else {
      return
    }
    terminalURL = html.standardizedFileURL
    resourceBundleURL = bundle.bundleURL.standardizedFileURL

    let initScript = WKUserScript(
      source: appearanceScript(initialize: true),
      injectionTime: .atDocumentEnd,
      forMainFrameOnly: true
    )
    webView.configuration.userContentController.removeAllUserScripts()
    webView.configuration.userContentController.addUserScript(initScript)
    webView.loadFileURL(html, allowingReadAccessTo: bundle.bundleURL)
  }

  private func applyAppearance() {
    guard ready else { return }
    webView.evaluateJavaScript(appearanceScript(initialize: false))
  }

  private func appearanceScript(initialize: Bool) -> String {
    let dark = colorScheme != "light"
    let foreground = dark ? "rgb(240, 240, 236)" : "rgb(34, 34, 31)"
    let background = dark ? "rgb(16, 16, 16)" : "rgb(247, 246, 240)"
    let cursor = dark ? "rgba(238, 170, 89, 0.85)" : "rgba(157, 92, 24, 0.85)"
    let clampedFontSize = min(max(fontSize, 10), 28)
    let settings = """
      var cjTheme = {
        color: [
          '#000000', '#CC0000', '#4E9A06', '#C4A000',
          '#3465A4', '#75507B', '#06989A', '#D3D7CF',
          '#555753', '#EF2929', '#00BA13', '#FCE94F',
          '#729FCF', '#F200CB', '#00B5BD', '#EEEEEC'
        ],
        foreground: '\(foreground)',
        background: '\(background)'
      };
      term_applySexyTheme(cjTheme);
      term_set('cursor-color', '\(cursor)');
      term_set('cursor-blink', true);
      term_set('enable-bold-as-bright', true);
      term_set('font-family', 'ui-monospace, Menlo, monospace');
      term_set('font-size', \(clampedFontSize));
      """

    if initialize {
      return """
        function applyUserSettings() {
          \(settings)
        }
        term_init(false, false);
        """
    }

    return """
      (function() {
        \(settings)
        if (typeof document !== 'undefined') {
          document.body.style.backgroundColor = '\(background)';
        }
      })();
      """
  }

  private func flushOutput() {
    guard ready, !outputEvaluationInFlight else { return }

    let data = outputQueue.sync { () -> Data in
      let chunkSize = min(pendingOutput.count, Self.maxOutputChunkBytes)
      let next = Data(pendingOutput.prefix(chunkSize))
      pendingOutput.removeFirst(chunkSize)
      outputFlushScheduled = !pendingOutput.isEmpty
      return next
    }

    guard !data.isEmpty else { return }

    let generation = terminalGeneration
    let base64 = data.base64EncodedString()
    outputEvaluationInFlight = true
    webView.evaluateJavaScript("term_write_b64('\(base64)');") { [weak self] _, _ in
      DispatchQueue.main.async {
        guard let self, self.terminalGeneration == generation else { return }
        self.outputEvaluationInFlight = false
        self.flushOutput()
      }
    }
  }

  private func enqueueOutput(_ data: Data) {
    if data.count >= Self.maxPendingOutputBytes {
      pendingOutput = Data(data.suffix(Self.maxPendingOutputBytes))
      return
    }

    let overflow = pendingOutput.count + data.count - Self.maxPendingOutputBytes
    if overflow > 0 {
      pendingOutput.removeFirst(overflow)
    }
    pendingOutput.append(data)
  }

  private func send(_ text: String) {
    guard !text.isEmpty else { return }
    onInput?(Data(text.utf8))
  }
}

extension BlinkTerminalSurface: WKScriptMessageHandler {
  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard
      message.name == "interOp" || message.name == "_kb",
      message.frameInfo.isMainFrame,
      message.frameInfo.securityOrigin.protocol == "file",
      webView.url?.standardizedFileURL == terminalURL
    else {
      return
    }
    guard
      let body = message.body as? [String: Any],
      let operation = body["op"] as? String
    else {
      return
    }

    // Blink's bundled keyboard bridge sends both software-keyboard and
    // hardware-keyboard output through the `_kb` handler. A plain WKWebView can
    // become the real first responder when its terminal canvas is tapped, so
    // UIKeyInput.insertText on this wrapper is not guaranteed to receive the
    // keystroke. Forward the bridge's finalized output (including composed IME
    // text) to the SSH PTY as Blink does in its own terminal view.
    if message.name == "_kb" {
      if operation == "out", let string = body["data"] as? String {
        send(string)
      }
      return
    }

    let data = body["data"] as? [String: Any] ?? [:]

    switch operation {
    case "terminalReady":
      let size = data["size"] as? [String: Any] ?? [:]
      updateSize(size)
      ready = true
      applyAppearance()
      onReady?(rows, columns)
      flushOutput()
    case "sigwinch":
      updateSize(data)
      onResize?(rows, columns)
    case "sendString":
      if let string = data["string"] as? String {
        send(string)
      }
    case "copy":
      if let content = data["content"] as? String {
        UIPasteboard.general.string = content
      }
    case "ring-bell":
      UIImpactFeedbackGenerator(style: .light).impactOccurred()
    default:
      break
    }
  }

  private func updateSize(_ data: [String: Any]) {
    let nextRows = (data["rows"] as? NSNumber)?.int32Value ?? rows
    let nextColumns = (data["cols"] as? NSNumber)?.int32Value ?? columns
    rows = max(nextRows, 1)
    columns = max(nextColumns, 1)
  }
}

extension BlinkTerminalSurface: WKNavigationDelegate {
  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    guard let url = navigationAction.request.url else {
      decisionHandler(.cancel)
      return
    }

    let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true
    let standardizedURL = url.standardizedFileURL
    let isTerminalPage = standardizedURL == terminalURL
    let isBundledFile = resourceBundleURL.map { bundleURL in
      standardizedURL.isFileURL
        && standardizedURL.path.hasPrefix(bundleURL.path + "/")
    } ?? false
    let isBlankSubframe = !isMainFrame && url.absoluteString == "about:blank"

    if (isMainFrame && isTerminalPage) || (!isMainFrame && (isBundledFile || isBlankSubframe)) {
      decisionHandler(.allow)
      return
    }

    if navigationAction.navigationType == .linkActivated,
       let scheme = url.scheme?.lowercased(),
       scheme == "https" || scheme == "http" {
      UIApplication.shared.open(url)
    }
    decisionHandler(.cancel)
  }
}

private final class BlinkTerminalAccessoryView: UIInputView {
  private let onKey: (String) -> Void
  private let onPaste: () -> Void

  init(onKey: @escaping (String) -> Void, onPaste: @escaping () -> Void) {
    self.onKey = onKey
    self.onPaste = onPaste
    super.init(frame: CGRect(x: 0, y: 0, width: 0, height: 46), inputViewStyle: .keyboard)
    allowsSelfSizing = true
    configure()
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  private func configure() {
    let items: [(String, String?)] = [
      ("Esc", "escape"),
      ("Tab", "tab"),
      ("⌃C", "ctrl+c"),
      ("⌃D", "ctrl+d"),
      ("←", "arrowleft"),
      ("↑", "arrowup"),
      ("↓", "arrowdown"),
      ("→", "arrowright"),
      ("Paste", nil),
    ]

    let stack = UIStackView()
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .horizontal
    stack.alignment = .fill
    stack.distribution = .fillEqually
    stack.spacing = 4
    addSubview(stack)

    NSLayoutConstraint.activate([
      stack.topAnchor.constraint(equalTo: topAnchor, constant: 4),
      stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 6),
      stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -6),
      stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4),
      heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
    ])

    for (title, key) in items {
      let button = UIButton(type: .system)
      button.setTitle(title, for: .normal)
      button.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
      button.accessibilityLabel = title
      button.addAction(
        UIAction { [weak self] _ in
          guard let self else { return }
          if let key {
            self.onKey(key)
          } else {
            self.onPaste()
          }
        },
        for: .touchUpInside
      )
      stack.addArrangedSubview(button)
    }
  }
}
