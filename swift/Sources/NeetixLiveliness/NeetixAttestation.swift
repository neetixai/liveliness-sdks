import Foundation
#if canImport(DeviceCheck)
import DeviceCheck
#endif
#if canImport(CryptoKit)
import CryptoKit
#endif

/// Client-side result of an Apple App Attest flow, ready to attach to a
/// `faceMatch` / `liveness` / `ageCheck` call. The server verifies the CBOR
/// attestation object fully offline (x5c chain to the Apple App Attest root
/// CA + nonce-extension check against `capture_nonce`).
public struct NeetixAttestationPayload: Sendable {
    /// Multipart `attest_platform` value. Always `"ios"` for this SDK.
    public let platform: String
    /// Multipart `attest_key_id`: the App Attest key identifier.
    public let keyId: String
    /// Multipart `attest_token`: the base64-encoded CBOR attestation object
    /// (`{fmt: "apple-appattest", attStmt: {x5c, receipt}, authData}`).
    public let attestationObjectBase64: String

    public init(platform: String = "ios", keyId: String, attestationObjectBase64: String) {
        self.platform = platform
        self.keyId = keyId
        self.attestationObjectBase64 = attestationObjectBase64
    }
}

/// Thin wrapper around `DCAppAttestService` (Apple App Attest).
///
/// Server contract: the request's `capture_nonce` field is the attestation
/// challenge. The leaf certificate's nonce extension must equal
/// `SHA256(authData || SHA256(capture_nonce))`, so `attestKey` passes
/// `SHA256(challenge)` as the `clientDataHash`.
///
/// Typical flow (one fresh key per capture):
///
///     let nonce = NeetixAttestation.makeNonce()
///     let att = try await NeetixAttestation.attest(captureNonce: nonce)
///     let res = try await client.faceMatch(
///         person: .jpeg(selfie), card: .jpeg(card),
///         captureNonce: nonce, attestation: att)
///
/// On unsupported targets (simulator, macOS `swift build`, Linux) every call
/// throws `NeetixError.unsupported` and `isSupported` is `false` — attach
/// `nil` and the API behaves exactly as before.
public enum NeetixAttestation {
    /// True when App Attest can run on this device (real iOS hardware with
    /// the DeviceCheck service available; false on simulators and macOS).
    public static var isSupported: Bool {
        #if canImport(DeviceCheck)
        if #available(iOS 14.0, macOS 11.0, macCatalyst 14.5, tvOS 15.0, watchOS 9.0, *) {
            return DCAppAttestService.shared.isSupported
        }
        #endif
        return false
    }

    /// Generate a random `capture_nonce` suitable as the attestation
    /// challenge. Send the SAME string as the request's `capture_nonce`.
    public static func makeNonce() -> String {
        UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
    }

    /// Generate a new App Attest key; returns its key identifier.
    public static func generateKey() async throws -> String {
        #if canImport(DeviceCheck)
        guard #available(iOS 14.0, macOS 11.0, macCatalyst 14.5, tvOS 15.0, watchOS 9.0, *) else {
            throw NeetixError.unsupported("App Attest requires iOS 14+")
        }
        let service = DCAppAttestService.shared
        guard service.isSupported else {
            throw NeetixError.unsupported(
                "App Attest is not supported here (simulator or unsupported device)")
        }
        return try await service.generateKey()
        #else
        throw NeetixError.unsupported("App Attest requires the DeviceCheck framework (iOS)")
        #endif
    }

    /// Attest `keyId` against a raw challenge (the UTF-8 bytes of the
    /// request's `capture_nonce`). Returns the base64-encoded CBOR
    /// attestation object for the `attest_token` multipart field.
    public static func attestKey(_ keyId: String, challenge: Data) async throws -> String {
        #if canImport(DeviceCheck) && canImport(CryptoKit)
        guard #available(iOS 14.0, macOS 11.0, macCatalyst 14.5, tvOS 15.0, watchOS 9.0, *) else {
            throw NeetixError.unsupported("App Attest requires iOS 14+")
        }
        let service = DCAppAttestService.shared
        guard service.isSupported else {
            throw NeetixError.unsupported(
                "App Attest is not supported here (simulator or unsupported device)")
        }
        // App Attest sets the leaf-cert nonce to SHA256(authData || clientDataHash);
        // the server expects SHA256(authData || SHA256(capture_nonce)), so
        // clientDataHash must be SHA256(challenge).
        let clientDataHash = Data(SHA256.hash(data: challenge))
        let object = try await service.attestKey(keyId, clientDataHash: clientDataHash)
        return object.base64EncodedString()
        #else
        throw NeetixError.unsupported("App Attest requires the DeviceCheck framework (iOS)")
        #endif
    }

    /// Convenience: generate a fresh key and attest it against
    /// `captureNonce` in one call. Attestation objects are single-use per
    /// key, so a fresh key per capture is the intended pattern here.
    public static func attest(captureNonce: String) async throws -> NeetixAttestationPayload {
        let keyId = try await generateKey()
        let token = try await attestKey(keyId, challenge: Data(captureNonce.utf8))
        return NeetixAttestationPayload(keyId: keyId, attestationObjectBase64: token)
    }
}
