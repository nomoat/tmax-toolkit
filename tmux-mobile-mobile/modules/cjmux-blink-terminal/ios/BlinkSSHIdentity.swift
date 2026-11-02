import Foundation
import Security
import SSH

private enum BlinkSSHIdentityError: LocalizedError {
  case invalidPrivateKeyEncoding
  case missingIdentity
  case keychain(OSStatus)

  var errorDescription: String? {
    switch self {
    case .invalidPrivateKeyEncoding:
      return "Blink generated an SSH key that could not be encoded."
    case .missingIdentity:
      return "The managed SSH identity is missing. Re-authorize this installation."
    case .keychain(let status):
      let detail = SecCopyErrorMessageString(status, nil) as String? ?? "status \(status)"
      return "Could not access the managed SSH identity in Keychain: \(detail)"
    }
  }
}

struct BlinkSSHManagedIdentity {
  let identityId: String
  let publicKey: String
  let fingerprint: String

  var dictionary: [String: String] {
    [
      "identityId": identityId,
      "deviceId": identityId,
      "publicKey": publicKey,
      "fingerprint": fingerprint,
    ]
  }
}

enum BlinkSSHIdentity {
  private static let lock = NSLock()
  private static let privateKeyService = "ai.impo.tmuxmobile.managed-ssh-private-key"
  private static let metadataService = "ai.impo.tmuxmobile.managed-ssh-metadata"
  private static let currentIdentityAccount = "current-identity"

  static func ensureManagedIdentity(
    installMarker: String?
  ) throws -> BlinkSSHManagedIdentity {
    lock.lock()
    defer { lock.unlock() }

    let expectedId = normalizedIdentityId(installMarker)
    let currentId = try currentIdentityId()
    if
      let expectedId,
      expectedId == currentId,
      let privateKey = try readPrivateKey(identityId: expectedId),
      let identity = try? describe(privateKey: privateKey, identityId: expectedId)
    {
      return identity
    }

    // AsyncStorage is removed on uninstall while Keychain can survive it. A
    // missing install marker intentionally rotates the native-held key.
    let nextId = expectedId ?? UUID().uuidString.lowercased()
    let key = try SSHKey(type: .ed25519, bits: 0)
    let comment = "cjmux@\(nextId)"
    let privateBlob = try key.privateKeyFileBlob(comment: comment)
    guard let privateKey = String(data: privateBlob, encoding: .utf8) else {
      throw BlinkSSHIdentityError.invalidPrivateKeyEncoding
    }
    let identity = BlinkSSHManagedIdentity(
      identityId: nextId,
      publicKey: try key.authorizedKey(withComment: comment),
      fingerprint: key.fingerprint(digest: .sha256, type: .base64)
    )

    try writePrivateKey(privateKey, identityId: nextId)
    do {
      try writeCurrentIdentityId(nextId)
    } catch {
      try? deletePrivateKey(identityId: nextId)
      throw error
    }
    if let currentId, currentId != nextId {
      try? deletePrivateKey(identityId: currentId)
    }
    return identity
  }

  static func privateKey(identityId rawIdentityId: String) throws -> String {
    lock.lock()
    defer { lock.unlock() }

    guard
      let identityId = normalizedIdentityId(rawIdentityId),
      try currentIdentityId() == identityId,
      let privateKey = try readPrivateKey(identityId: identityId)
    else {
      throw BlinkSSHIdentityError.missingIdentity
    }
    return privateKey
  }

  private static func describe(
    privateKey: String,
    identityId: String
  ) throws -> BlinkSSHManagedIdentity {
    let key = try SSHKey(fromFileBlob: Data(privateKey.utf8))
    return BlinkSSHManagedIdentity(
      identityId: identityId,
      publicKey: try key.authorizedKey(withComment: "cjmux@\(identityId)"),
      fingerprint: key.fingerprint(digest: .sha256, type: .base64)
    )
  }

  private static func normalizedIdentityId(_ value: String?) -> String? {
    guard let value else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard
      !trimmed.isEmpty,
      trimmed.count <= 128,
      trimmed.range(of: #"^[A-Za-z0-9._-]+$"#, options: .regularExpression) != nil
    else {
      return nil
    }
    return trimmed
  }

  private static func currentIdentityId() throws -> String? {
    guard
      let data = try readKeychainData(
        service: metadataService,
        account: currentIdentityAccount
      )
    else {
      return nil
    }
    return String(data: data, encoding: .utf8).flatMap(normalizedIdentityId)
  }

  private static func writeCurrentIdentityId(_ identityId: String) throws {
    try writeKeychainData(
      Data(identityId.utf8),
      service: metadataService,
      account: currentIdentityAccount
    )
  }

  private static func readPrivateKey(identityId: String) throws -> String? {
    guard
      let data = try readKeychainData(
        service: privateKeyService,
        account: identityId
      )
    else {
      return nil
    }
    return String(data: data, encoding: .utf8)
  }

  private static func writePrivateKey(
    _ privateKey: String,
    identityId: String
  ) throws {
    try writeKeychainData(
      Data(privateKey.utf8),
      service: privateKeyService,
      account: identityId
    )
  }

  private static func deletePrivateKey(identityId: String) throws {
    let status = SecItemDelete([
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: privateKeyService,
      kSecAttrAccount: identityId,
    ] as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw BlinkSSHIdentityError.keychain(status)
    }
  }

  private static func readKeychainData(
    service: String,
    account: String
  ) throws -> Data? {
    var result: CFTypeRef?
    let status = SecItemCopyMatching([
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: account,
      kSecMatchLimit: kSecMatchLimitOne,
      kSecReturnData: true,
    ] as CFDictionary, &result)
    if status == errSecItemNotFound {
      return nil
    }
    guard status == errSecSuccess, let data = result as? Data else {
      throw BlinkSSHIdentityError.keychain(status)
    }
    return data
  }

  private static func writeKeychainData(
    _ data: Data,
    service: String,
    account: String
  ) throws {
    let query = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: account,
    ] as CFDictionary
    let updateStatus = SecItemUpdate(query, [
      kSecValueData: data,
      kSecAttrAccessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    ] as CFDictionary)
    if updateStatus == errSecSuccess {
      return
    }
    guard updateStatus == errSecItemNotFound else {
      throw BlinkSSHIdentityError.keychain(updateStatus)
    }

    let addStatus = SecItemAdd([
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: account,
      kSecValueData: data,
      kSecAttrAccessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    ] as CFDictionary, nil)
    guard addStatus == errSecSuccess else {
      throw BlinkSSHIdentityError.keychain(addStatus)
    }
  }
}
