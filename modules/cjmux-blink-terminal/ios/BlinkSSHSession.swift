import BlinkFiles
import Combine
import Foundation
import SSH

private enum BlinkSSHSessionError: LocalizedError {
  case rejectedHostKey
  case missingAuthentication
  case unsupportedInteractiveAuthentication
  case cancelled

  var errorDescription: String? {
    switch self {
    case .rejectedHostKey:
      return "Host key was not accepted."
    case .missingAuthentication:
      return "Enter a password or private key for this SSH connection."
    case .unsupportedInteractiveAuthentication:
      return "This server requested an interactive authentication challenge that T-MAX cannot answer safely."
    case .cancelled:
      return "Connection cancelled."
    }
  }
}

final class BlinkSSHSession {
  private static let clientLifetimeLock = NSLock()
  private static let initializeSSHOnce: Void = {
    SSHInit()
  }()
  private static let workerRunLoopModes: [RunLoop.Mode] = [
    .default,
    RunLoop.Mode("LibSSHBlockRunLoop"),
  ]

  var onOutput: ((Data) -> Void)?
  var onStateChange: ((String, String?) -> Void)?
  var onHostKeyPrompt: ((String, Bool) -> Void)?
  var onExit: ((String) -> Void)?

  private let configuration: BlinkTerminalConfiguration
  private let initialRows: Int32
  private let initialColumns: Int32
  private let input = BlinkSSHInput()
  private lazy var output = BlinkSSHOutput { [weak self] data in
    self?.onOutput?(data)
  }

  private let stateLock = NSLock()
  private var connectionCancellable: AnyCancellable?
  private var resizeCancellable: AnyCancellable?
  private var client: SSHClient?
  private var stream: SSH.Stream?
  private var workerRunLoop: RunLoop?
  private var workerThread: Thread?
  private var stopped = false
  private var pendingHostKeyDecision: ((Bool) -> Void)?
  private var pendingRows: Int32
  private var pendingColumns: Int32

  init(
    configuration: BlinkTerminalConfiguration,
    rows: Int32,
    columns: Int32
  ) {
    self.configuration = configuration
    initialRows = max(rows, 1)
    initialColumns = max(columns, 1)
    pendingRows = max(rows, 1)
    pendingColumns = max(columns, 1)
  }

  func connect() {
    stateLock.lock()
    guard workerThread == nil else {
      stateLock.unlock()
      return
    }
    stopped = false
    let thread = Thread { [weak self] in
      self?.run()
    }
    thread.name = "ai.impo.cjmux.blink-ssh"
    thread.qualityOfService = .userInitiated
    workerThread = thread
    stateLock.unlock()
    thread.start()
  }

  func send(_ data: Data) {
    guard !data.isEmpty else { return }
    input.send(data)
  }

  func resize(rows: Int32, columns: Int32) {
    let nextRows = max(rows, 1)
    let nextColumns = max(columns, 1)

    stateLock.lock()
    pendingRows = nextRows
    pendingColumns = nextColumns
    let runLoop = workerRunLoop
    stateLock.unlock()

    runLoop?.perform(inModes: Self.workerRunLoopModes) { [weak self] in
      guard let self, let stream = self.stream else { return }
      self.resizeCancellable = stream
        .resizePty(rows: nextRows, columns: nextColumns)
        .sink(
          receiveCompletion: { [weak self] _ in
            self?.resizeCancellable = nil
          },
          receiveValue: { _ in }
        )
    }
  }

  func approveHostKey(_ accepted: Bool) {
    stateLock.lock()
    let decision = pendingHostKeyDecision
    pendingHostKeyDecision = nil
    let runLoop = workerRunLoop
    stateLock.unlock()
    if let runLoop {
      runLoop.perform(inModes: Self.workerRunLoopModes) {
        decision?(accepted)
      }
    } else {
      decision?(accepted)
    }
  }

  func disconnect() {
    stateLock.lock()
    guard !stopped else {
      stateLock.unlock()
      return
    }
    stopped = true
    let runLoop = workerRunLoop
    let decision = pendingHostKeyDecision
    pendingHostKeyDecision = nil
    stateLock.unlock()

    input.close()

    if let runLoop {
      runLoop.perform(inModes: Self.workerRunLoopModes) { [weak self] in
        decision?(false)
        self?.finish(reason: "Disconnected", publishExit: false)
      }
    } else {
      decision?(false)
    }
  }

  private func run() {
    autoreleasepool {
      stateLock.lock()
      workerRunLoop = RunLoop.current
      stateLock.unlock()

      // Blink's libssh logger stores an unretained SSHClient in global userdata.
      // Keep client lifetimes serialized so reconnecting cannot leave that pointer
      // referring to a different or already-deallocated client.
      Self.clientLifetimeLock.lock()
      defer {
        Self.clientLifetimeLock.unlock()
      }

      guard !isStopped else {
        drainWorkerRunLoop()
        finish(reason: "Disconnected", publishExit: false)
        drainWorkerRunLoop()
        cleanupWorker()
        return
      }

      _ = Self.initializeSSHOnce
      publishState("connecting", message: "Connecting to \(configuration.host)…")

      do {
        let sshDirectory = try Self.prepareSSHDirectory()
        let methods = try authenticationMethods()
        let config = SSHClientConfig(
          user: configuration.user,
          port: String(configuration.port),
          authMethods: methods,
          loggingVerbosity: SSHLogLevel.none,
          verifyHostCallback: { [weak self] verifyHost in
            guard let self else {
              return Fail(error: BlinkSSHSessionError.cancelled).eraseToAnyPublisher()
            }
            return self.verifyHost(verifyHost)
          },
          connectionTimeout: 30,
          sshDirectory: sshDirectory,
          sshClientConfigPath: nil
        )

        let pty = SSHClient.PTY(
          rows: initialRows,
          columns: initialColumns,
          emulator: "xterm-256color"
        )

        connectionCancellable = SSHClient
          .dial(configuration.host, with: config)
          .handleEvents(receiveOutput: { [weak self] client in
            self?.client = client
            self?.publishState("authenticating", message: "Authenticated. Opening terminal…")
          })
          .flatMap { client -> AnyPublisher<SSH.Stream, Error> in
            if self.configuration.command.isEmpty {
              return client.requestInteractiveShell(
                withPTY: pty,
                withEnvVars: ["TERM": "xterm-256color"]
              )
            }
            return client.requestExec(
              command: self.configuration.command,
              withPTY: pty,
              withEnvVars: ["TERM": "xterm-256color"]
            )
          }
          .sink(
            receiveCompletion: { [weak self] completion in
              guard let self else { return }
              if case .failure(let error) = completion {
                self.finish(reason: self.userFacingMessage(for: error), publishExit: true)
              }
            },
            receiveValue: { [weak self] stream in
              self?.start(stream)
            }
          )

        while !isStopped {
          autoreleasepool {
            _ = RunLoop.current.run(
              mode: .default,
              before: Date(timeIntervalSinceNow: 0.25)
            )
          }
        }
      } catch {
        finish(reason: userFacingMessage(for: error), publishExit: true)
      }

      // A disconnect can set stopped between two run-loop iterations. Process
      // its queued teardown block, then perform an idempotent teardown here as a
      // fallback. Draining once more lets SSH.Stream deinit run closeChannel on
      // its owning run loop before another SSHClient acquires the global lock.
      drainWorkerRunLoop()
      finish(reason: "Disconnected", publishExit: false)
      drainWorkerRunLoop()
      cleanupWorker()
    }
  }

  private func authenticationMethods() throws -> [AuthMethod] {
    var methods: [AuthMethod] = []
    if !configuration.identityId.isEmpty {
      methods.append(
        AuthPublicKey(
          privateKey: try BlinkSSHIdentity.privateKey(
            identityId: configuration.identityId
          ),
          keyName: "T-MAX managed key"
        )
      )
    }
    if !configuration.privateKey.isEmpty {
      methods.append(
        AuthPublicKey(
          privateKey: SSHKey.sanitize(key: configuration.privateKey),
          keyName: "T-MAX"
        )
      )
    }
    if !configuration.password.isEmpty {
      let password = configuration.password
      methods.append(AuthPassword(with: password))
      methods.append(
        AuthKeyboardInteractive(
          requestAnswers: { prompt in
            guard
              prompt.userPrompts.count == 1,
              let question = prompt.userPrompts.first,
              !question.echo,
              question.prompt.range(of: "password", options: .caseInsensitive) != nil
            else {
              return Fail<[String], Error>(
                error: BlinkSSHSessionError.unsupportedInteractiveAuthentication
              )
              .eraseToAnyPublisher()
            }
            return Just([password])
              .setFailureType(to: Error.self)
              .eraseToAnyPublisher()
          },
          wrongRetriesAllowed: 0
        )
      )
    }
    guard !methods.isEmpty else {
      throw BlinkSSHSessionError.missingAuthentication
    }
    return methods
  }

  private func verifyHost(_ verifyHost: VerifyHost) -> AnyPublisher<InteractiveResponse, Error> {
    let fingerprint: String
    let changed: Bool
    switch verifyHost {
    case .changed(let serverFingerprint):
      fingerprint = serverFingerprint
      changed = true
    case .unknown(let serverFingerprint), .notFound(let serverFingerprint):
      fingerprint = serverFingerprint
      changed = false
    @unknown default:
      return Fail(error: BlinkSSHSessionError.cancelled)
        .eraseToAnyPublisher()
    }

    publishState(
      "verifying-host",
      message: changed ? "The host key changed." : "Confirm this host key."
    )

    return Future<InteractiveResponse, Error> { [weak self] promise in
      guard let self else {
        promise(.failure(BlinkSSHSessionError.cancelled))
        return
      }

      self.stateLock.lock()
      self.pendingHostKeyDecision = { accepted in
        if accepted {
          promise(.success(.affirmative))
        } else {
          promise(.failure(BlinkSSHSessionError.rejectedHostKey))
        }
      }
      self.stateLock.unlock()

      DispatchQueue.main.async {
        self.onHostKeyPrompt?(fingerprint, changed)
      }
    }
    .eraseToAnyPublisher()
  }

  private func start(_ stream: SSH.Stream) {
    self.stream = stream
    stream.handleCompletion = { [weak self] in
      self?.finish(reason: "Remote terminal closed.", publishExit: true)
    }
    stream.handleFailure = { [weak self] error in
      guard let self else { return }
      self.finish(reason: self.userFacingMessage(for: error), publishExit: true)
    }
    stream.connect(stdout: output, stdin: input, stderr: output)

    stateLock.lock()
    let rows = pendingRows
    let columns = pendingColumns
    stateLock.unlock()

    resizeCancellable = stream
      .resizePty(rows: rows, columns: columns)
      .sink(
        receiveCompletion: { [weak self] _ in
          self?.resizeCancellable = nil
        },
        receiveValue: { _ in }
      )

    publishState("connected", message: "Connected")
  }

  private func finish(reason: String, publishExit: Bool) {
    stateLock.lock()
    let wasStopped = stopped
    stopped = true
    stateLock.unlock()

    stream?.cancel()
    stream = nil
    client = nil
    connectionCancellable?.cancel()
    connectionCancellable = nil
    resizeCancellable?.cancel()
    resizeCancellable = nil
    input.close()

    if !wasStopped {
      publishState(
        publishExit ? "failed" : "disconnected",
        message: reason
      )
      if publishExit {
        DispatchQueue.main.async { [weak self] in
          self?.onExit?(reason)
        }
      }
    }
  }

  private func cleanupWorker() {
    stateLock.lock()
    workerRunLoop = nil
    workerThread = nil
    stateLock.unlock()
  }

  private func drainWorkerRunLoop() {
    for _ in 0..<4 {
      _ = RunLoop.current.run(
        mode: .default,
        before: Date(timeIntervalSinceNow: 0.01)
      )
    }
  }

  private var isStopped: Bool {
    stateLock.lock()
    defer { stateLock.unlock() }
    return stopped
  }

  private func publishState(_ state: String, message: String?) {
    DispatchQueue.main.async { [weak self] in
      self?.onStateChange?(state, message)
    }
  }

  private func userFacingMessage(for error: Error) -> String {
    guard let sshError = error as? SSHError else {
      return error.localizedDescription
    }
    switch sshError {
    case .connError:
      return "\(sshError.description) If this is a local address, also check that T-MAX has Local Network access in iOS Settings."
    default:
      return sshError.description
    }
  }

  private static func prepareSSHDirectory() throws -> String {
    let root = try FileManager.default.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    let directory = root
      .appendingPathComponent("CJMUXBlinkSSH", isDirectory: true)
      .appendingPathComponent(".ssh", isDirectory: true)
    try FileManager.default.createDirectory(
      at: directory,
      withIntermediateDirectories: true
    )
    return directory.path
  }

  deinit {
    disconnect()
  }
}

private final class BlinkSSHOutput: Writer {
  private let receive: (Data) -> Void

  init(receive: @escaping (Data) -> Void) {
    self.receive = receive
  }

  func write(_ buffer: DispatchData, max length: Int) -> AnyPublisher<Int, Error> {
    let data = Data(buffer)
    receive(data)
    return Just(min(length, data.count))
      .setFailureType(to: Error.self)
      .eraseToAnyPublisher()
  }
}

private final class BlinkSSHInput: WriterTo {
  private let subject = PassthroughSubject<DispatchData, Error>()
  private let lock = NSLock()
  private var closed = false

  func writeTo(_ writer: Writer) -> AnyPublisher<Int, Error> {
    subject
      .flatMap(maxPublishers: .max(1)) { data in
        writer.write(data, max: data.count)
      }
      .eraseToAnyPublisher()
  }

  func send(_ data: Data) {
    lock.lock()
    let isClosed = closed
    lock.unlock()
    guard !isClosed else { return }

    let dispatchData = data.withUnsafeBytes { bytes in
      DispatchData(bytes: bytes)
    }
    subject.send(dispatchData)
  }

  func close() {
    lock.lock()
    guard !closed else {
      lock.unlock()
      return
    }
    closed = true
    lock.unlock()
    subject.send(completion: .finished)
  }
}
