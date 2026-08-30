import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Errors surfaced by the client.
public enum NeetixError: Error {
    case badResponse(status: Int, body: String)
    case decoding(String)
    case transport(Error)
}

/// A face image to upload: either raw JPEG data or a file URL.
public enum ImageInput {
    case jpeg(Data)
    case fileURL(URL)

    fileprivate func data() throws -> Data {
        switch self {
        case .jpeg(let d): return d
        case .fileURL(let u): return try Data(contentsOf: u)
        }
    }
}

/// Neetix Liveliness API client. Pure Foundation networking — no UIKit, so it
/// builds and unit-tests on macOS/Linux; the camera capture layer
/// (`NeetixCamera`) is iOS-only and gated behind `#if canImport(UIKit)`.
public final class NeetixClient {
    private let baseURL: URL
    private let apiKey: String?
    private let session: URLSession

    public init(baseURL: String, apiKey: String? = nil, session: URLSession = .shared) {
        self.baseURL = URL(string: baseURL.hasSuffix("/") ? String(baseURL.dropLast()) : baseURL)!
        self.apiKey = apiKey
        self.session = session
    }

    // MARK: - Public API

    /// Passive liveliness on a single selfie.
    public func liveness(selfie: ImageInput) async throws -> LivenessResponse {
        try await postMultipart("/v1/liveness", images: [("person", selfie)])
    }

    /// Face match + liveliness.
    public func faceMatch(
        selfie: ImageInput, card: ImageInput, fields: [String: String] = [:]
    ) async throws -> FaceMatchResponse {
        try await postMultipart(
            "/v1/face/face-match",
            images: [("person", selfie), ("card", card)],
            fields: fields
        )
    }

    /// Enroll a user's face for biometric authentication.
    @discardableResult
    public func authEnroll(userId: String, selfie: ImageInput) async throws -> EnrollResponse {
        try await postMultipart(
            "/v1/auth/enroll", images: [("person", selfie)], fields: ["user_id": userId]
        )
    }

    /// Authenticate a returning user by face + liveliness.
    public func authVerify(userId: String, selfie: ImageInput) async throws -> AuthVerifyResponse {
        try await postMultipart(
            "/v1/auth/verify", images: [("person", selfie)], fields: ["user_id": userId]
        )
    }

    /// Parse + validate a passport/ID MRZ.
    public func parseMRZ(_ mrz: String) async throws -> MRZResponse {
        try await postJSON("/v1/document/mrz", body: ["mrz": mrz])
    }

    // MARK: - Transport

    private func request(_ path: String) -> URLRequest {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = "POST"
        if let apiKey { req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization") }
        return req
    }

    private func postMultipart<T: Decodable>(
        _ path: String,
        images: [(String, ImageInput)],
        fields: [String: String] = [:]
    ) async throws -> T {
        let boundary = "neetix.\(UUID().uuidString)"
        var req = request(path)
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        func append(_ s: String) { body.append(s.data(using: .utf8)!) }
        for (name, value) in fields {
            append("--\(boundary)\r\n")
            append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
            append("\(value)\r\n")
        }
        for (name, image) in images {
            let data = try image.data()
            append("--\(boundary)\r\n")
            append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"image.jpg\"\r\n")
            append("Content-Type: image/jpeg\r\n\r\n")
            body.append(data)
            append("\r\n")
        }
        append("--\(boundary)--\r\n")
        req.httpBody = body
        return try await send(req)
    }

    private func postJSON<T: Decodable>(_ path: String, body: [String: String]) async throws -> T {
        var req = request(path)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await send(req)
    }

    private func send<T: Decodable>(_ req: URLRequest) async throws -> T {
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw NeetixError.transport(error)
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw NeetixError.badResponse(status: status, body: String(data: data, encoding: .utf8) ?? "")
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw NeetixError.decoding("\(error)")
        }
    }
}
