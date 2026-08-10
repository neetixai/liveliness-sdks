import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Errors surfaced by the client. `.api` carries the HTTP status plus the
/// stable machine-readable `messageCode` from the server's error envelope
/// (e.g. `unauthorized`, `no_face_detected`, `insufficient_credits`).
public enum NeetixError: Error {
    case api(status: Int, messageCode: String?, message: String, body: Data)
    case decoding(String)
    case transport(Error)

    /// True when the prepaid balance is exhausted (HTTP 402).
    public var isInsufficientCredits: Bool {
        if case let .api(status, code, _, _) = self {
            return status == 402 || code == "insufficient_credits"
        }
        return false
    }
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

/// Neetix Liveliness API client (async/await, URLSession). Pure Foundation
/// networking — no UIKit — so it builds and unit-tests on macOS/Linux; the
/// camera capture layer (`NeetixCamera`) is iOS-only and gated behind
/// `#if canImport(UIKit)`.
///
/// Every billable call deducts prepaid credits (face-match 2, stream 5,
/// KYB 2, others 1). An exhausted balance throws
/// `NeetixError.api(status: 402, messageCode: "insufficient_credits", …)`.
public final class NeetixClient {
    public static let defaultBaseURL = "https://liveliness.neetix.in"

    private let baseURL: URL
    private let apiKey: String?
    private let session: URLSession

    public init(
        baseURL: String = NeetixClient.defaultBaseURL,
        apiKey: String? = nil,
        session: URLSession = .shared
    ) {
        self.baseURL = URL(string: baseURL.hasSuffix("/") ? String(baseURL.dropLast()) : baseURL)!
        self.apiKey = apiKey
        self.session = session
    }

    // MARK: - Account

    /// Self-serve trial signup — no auth needed. Grants 500 free credits.
    /// The returned `apiKey` is shown ONCE; persist it.
    public func signup(email: String) async throws -> SignupResponse {
        try await postJSON("/v1/signup", body: ["email": email], authenticated: false)
    }

    // MARK: - Face & liveliness

    /// Passive liveliness on a single selfie. Cost: 1 credit.
    public func liveness(person: ImageInput) async throws -> LivenessResponse {
        try await postMultipart("/v1/liveness", images: [("person", person)])
    }

    /// Face match + liveliness (selfie vs ID/reference). Cost: 2 credits.
    /// Inspect `verdict` (`approved | review | declined`) and `warnings`.
    public func faceMatch(
        person: ImageInput,
        card: ImageInput,
        clientRefId: String? = nil,
        customerId: String? = nil,
        extraFields: [String: String] = [:]
    ) async throws -> FaceMatchResponse {
        var fields = extraFields
        if let clientRefId { fields["client_ref_id"] = clientRefId }
        if let customerId { fields["customer_id"] = customerId }
        return try await postMultipart(
            "/v1/face/face-match",
            images: [("person", person), ("card", card)],
            fields: fields
        )
    }

    /// Selfie age estimation. Cost: 1 credit.
    /// New endpoint — older deployments return 404 (`messageCode: "not_found"`).
    public func ageCheck(person: ImageInput) async throws -> AgeCheckResponse {
        try await postMultipart("/v1/age", images: [("person", person)])
    }

    // MARK: - Active-challenge liveliness

    /// Start an active-challenge liveliness session.
    public func sessionStart() async throws -> SessionStartResponse {
        try await postMultipart("/v1/session/start", images: [])
    }

    /// Submit the ordered challenge frames (`frame_0, frame_1, …`).
    public func sessionVerify(
        sessionId: String, frames: [ImageInput]
    ) async throws -> SessionVerifyResponse {
        let images = frames.enumerated().map { ("frame_\($0.offset)", $0.element) }
        return try await postMultipart("/v1/session/\(sessionId)/verify", images: images)
    }

    // MARK: - Biometric auth

    /// Enroll a user's face for biometric authentication.
    @discardableResult
    public func authEnroll(userId: String, person: ImageInput) async throws -> EnrollResponse {
        try await postMultipart(
            "/v1/auth/enroll", images: [("person", person)], fields: ["user_id": userId]
        )
    }

    /// Authenticate a returning user by face + liveliness.
    public func authVerify(userId: String, person: ImageInput) async throws -> AuthVerifyResponse {
        try await postMultipart(
            "/v1/auth/verify", images: [("person", person)], fields: ["user_id": userId]
        )
    }

    // MARK: - Screening & documents

    /// AML / sanctions & PEP screening by name (+ optional DOB "YYYY-MM-DD").
    /// Cost: 1 credit.
    public func amlScreen(
        name: String, dob: String? = nil, threshold: Double? = nil
    ) async throws -> AmlScreenResponse {
        var body: [String: Any] = ["name": name]
        if let dob { body["dob"] = dob }
        if let threshold { body["threshold"] = threshold }
        return try await postJSON("/v1/aml/screen", body: body)
    }

    /// KYB: validate Indian business identifiers (GSTIN / PAN / CIN) —
    /// only the identifiers you send come back. Cost: 2 credits.
    public func kybValidate(
        gstin: String? = nil, pan: String? = nil, cin: String? = nil
    ) async throws -> KybValidateResponse {
        var body: [String: Any] = [:]
        if let gstin { body["gstin"] = gstin }
        if let pan { body["pan"] = pan }
        if let cin { body["cin"] = cin }
        return try await postJSON("/v1/kyb/validate", body: body)
    }

    /// Parse + checksum-validate a passport/ID MRZ (2 or 3 lines). Cost: 1 credit.
    public func mrzParse(_ mrz: String) async throws -> MrzResponse {
        try await postJSON("/v1/document/mrz", body: ["mrz": mrz])
    }

    // MARK: - Billing (prepaid credits)

    /// Current prepaid-credit balance.
    public func balance() async throws -> BalanceResponse {
        try await getJSON("/v1/billing/balance")
    }

    /// Credit ledger, newest first.
    public func ledger(limit: Int = 50) async throws -> LedgerResponse {
        try await getJSON("/v1/billing/ledger?limit=\(limit)")
    }

    /// Purchasable credit packs.
    public func packs() async throws -> PacksResponse {
        try await getJSON("/v1/billing/packs")
    }

    /// Create a hosted-checkout top-up; open `checkoutUrl` from the result.
    public func topup(pack: String, email: String? = nil) async throws -> TopupResponse {
        var body: [String: Any] = ["pack": pack]
        if let email { body["email"] = email }
        return try await postJSON("/v1/billing/topup", body: body)
    }

    // MARK: - Transport

    private func request(_ path: String, method: String, authenticated: Bool = true) -> URLRequest {
        var req = URLRequest(url: URL(string: baseURL.absoluteString + path)!)
        req.httpMethod = method
        if authenticated, let apiKey {
            req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        return req
    }

    private func postMultipart<T: Decodable>(
        _ path: String,
        images: [(String, ImageInput)],
        fields: [String: String] = [:]
    ) async throws -> T {
        let boundary = "neetix.\(UUID().uuidString)"
        var req = request(path, method: "POST")
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

    private func postJSON<T: Decodable>(
        _ path: String, body: [String: Any], authenticated: Bool = true
    ) async throws -> T {
        var req = request(path, method: "POST", authenticated: authenticated)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await send(req)
    }

    private func getJSON<T: Decodable>(_ path: String) async throws -> T {
        let req = request(path, method: "GET")
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
            var message = "HTTP \(status)"
            var code: String? = nil
            if let envelope = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                // Standard envelope carries `message` + `message_code`;
                // face-match domain errors carry an `error` string instead.
                message = envelope["message"] as? String
                    ?? envelope["error"] as? String
                    ?? message
                code = envelope["message_code"] as? String
            }
            throw NeetixError.api(status: status, messageCode: code, message: message, body: data)
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw NeetixError.decoding("\(error)")
        }
    }
}
