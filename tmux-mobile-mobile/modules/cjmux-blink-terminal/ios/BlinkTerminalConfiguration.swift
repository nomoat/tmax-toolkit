import Foundation

struct BlinkTerminalConfiguration: Equatable {
  var host = ""
  var user = ""
  var port = 22
  var password = ""
  var privateKey = ""
  var identityId = ""
  var command = ""
  var connectionKey = ""

  var isValid: Bool {
    !host.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && !user.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && (1...65_535).contains(port)
      && !connectionKey.isEmpty
  }
}
