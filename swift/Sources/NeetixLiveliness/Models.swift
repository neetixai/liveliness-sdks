import Foundation

/// One entry of the risk-policy `warnings[]` array.
public struct ApiWarning: Codable {
    public let code: String
    public let severity: String // "decline" | "review"
    public let description: String
}

/// `POST /v1/signup` — the `apiKey` is shown ONCE; persist it.
public struct SignupResponse: Codable {
    public let status: String
    public let apiKey: String
    public let clientId: String
    public let credits: Int?
    public let message: String?

    enum CodingKeys: String, CodingKey {
        case status, credits, message
        case apiKey = "api_key"
        case clientId = "client_id"
    }
}

/// `POST /v1/liveness`
public struct LivenessResponse: Codable {
    public let status: String // "Approved" | "Declined" | "Not Finished"
    public let livenessScore: Double
    public let livenessStatus: String
    public let faceCount: Int?

    public var approved: Bool { status == "Approved" }

    enum CodingKeys: String, CodingKey {
        case status
        case livenessScore = "liveness_score"
        case livenessStatus = "liveness_status"
        case faceCount = "face_count"
    }
}

/// `POST /v1/age` — selfie age estimation. New endpoint: every field is
/// optional so decoding stays robust as the shape evolves.
public struct AgeCheckResponse: Codable {
    public let status: String?
    public let ageBracket: String?
    public let estimatedAge: Double?
    public let isAdult: Bool?
    public let verdict: String?
    public let warnings: [ApiWarning]?

    enum CodingKeys: String, CodingKey {
        case status, verdict, warnings
        case ageBracket = "age_bracket"
        case estimatedAge = "estimated_age"
        case isAdult = "is_adult"
    }
}

public struct FaceSignals: Codable {
    public let maskConfidence: Double?
    public let leftEyeOpen: Double?
    public let rightEyeOpen: Double?
    public let ageBracket: String?
    public let gender: String?
    public let emotion: String?

    enum CodingKeys: String, CodingKey {
        case maskConfidence = "mask_confidence"
        case leftEyeOpen = "left_eye_open"
        case rightEyeOpen = "right_eye_open"
        case ageBracket = "age_bracket"
        case gender, emotion
    }
}

public struct CaptureIntegrity: Codable {
    public let selfieSha256: String?
    public let exifPresent: Bool?
    public let edited: Bool?
    public let replayed: Bool?
    public let signedCapture: Bool?

    enum CodingKeys: String, CodingKey {
        case edited, replayed
        case selfieSha256 = "selfie_sha256"
        case exifPresent = "exif_present"
        case signedCapture = "signed_capture"
    }
}

public struct FaceMatchResult: Codable {
    public let isSameFace: Bool
    public let sameFaceConfidence: Double
    public let cosineSimilarity: Double?
    public let livenessScore: Double
    public let livenessStatus: String
    public let spoofDetected: Bool
    public let faceSignals: FaceSignals?
    public let capture: CaptureIntegrity?
    public let modelVersion: String?
    public let latencyMs: Double?

    enum CodingKeys: String, CodingKey {
        case capture
        case isSameFace = "is_same_face"
        case sameFaceConfidence = "same_face_confidence"
        case cosineSimilarity = "cosine_similarity"
        case livenessScore = "liveness_score"
        case livenessStatus = "liveness_status"
        case spoofDetected = "spoof_detected"
        case faceSignals = "face_signals"
        case modelVersion = "model_version"
        case latencyMs = "latency_ms"
    }
}

/// `POST /v1/face/face-match`
public struct FaceMatchResponse: Codable {
    public let status: String
    public let verdict: String // "approved" | "review" | "declined"
    public let warnings: [ApiWarning]
    public let result: FaceMatchResult

    public var approved: Bool { verdict == "approved" }
}

/// `POST /v1/auth/verify`
public struct AuthVerifyResponse: Codable {
    public let authenticated: Bool
    public let userId: String
    public let matchConfidence: Double
    public let livenessScore: Double
    public let livenessOk: Bool

    enum CodingKeys: String, CodingKey {
        case authenticated
        case userId = "user_id"
        case matchConfidence = "match_confidence"
        case livenessScore = "liveness_score"
        case livenessOk = "liveness_ok"
    }
}

/// `POST /v1/auth/enroll`
public struct EnrollResponse: Codable {
    public let status: String
    public let enrollmentId: String?
    public let userId: String?

    enum CodingKeys: String, CodingKey {
        case status
        case enrollmentId = "enrollment_id"
        case userId = "user_id"
    }
}

/// `POST /v1/session/start`
public struct SessionStartResponse: Codable {
    public let status: String
    public let sessionId: String
    public let challenges: [String]
    public let expiresAt: String?
    public let instructions: String?

    enum CodingKeys: String, CodingKey {
        case status, challenges, instructions
        case sessionId = "session_id"
        case expiresAt = "expires_at"
    }
}

/// `POST /v1/session/{id}/verify` — loosely typed verdict envelope.
public struct SessionVerifyResponse: Codable {
    public let status: String?
    public let verdict: String?
    public let warnings: [ApiWarning]?
}

/// One watchlist hit from `POST /v1/aml/screen`.
public struct AmlMatch: Codable {
    public let matchedName: String
    public let score: Double
    public let list: String
    public let country: String?
    public let program: String?
    public let dobMatch: Bool?

    enum CodingKeys: String, CodingKey {
        case score, list, country, program
        case matchedName = "matched_name"
        case dobMatch = "dob_match"
    }
}

/// `POST /v1/aml/screen`
public struct AmlScreenResponse: Codable {
    public let status: String
    public let query: String?
    public let screenedAgainst: Int?
    public let threshold: Double?
    public let hit: Bool
    public let matches: [AmlMatch]

    enum CodingKeys: String, CodingKey {
        case status, query, threshold, hit, matches
        case screenedAgainst = "screened_against"
    }
}

/// `POST /v1/kyb/validate` — GSTIN result (present only if you sent `gstin`).
public struct KybGstin: Codable {
    public let input: String
    public let valid: Bool
    public let checksumValid: Bool?
    public let stateCode: String?
    public let state: String?
    public let pan: String?
    public let entityNumber: String?
    public let expectedCheckDigit: String?

    enum CodingKeys: String, CodingKey {
        case input, valid, state, pan
        case checksumValid = "checksum_valid"
        case stateCode = "state_code"
        case entityNumber = "entity_number"
        case expectedCheckDigit = "expected_check_digit"
    }
}

/// `POST /v1/kyb/validate` — PAN result (present only if you sent `pan`).
public struct KybPan: Codable {
    public let input: String
    public let valid: Bool
    public let entityTypeCode: String?
    public let entityType: String?

    enum CodingKeys: String, CodingKey {
        case input, valid
        case entityTypeCode = "entity_type_code"
        case entityType = "entity_type"
    }
}

/// `POST /v1/kyb/validate` — CIN result (present only if you sent `cin`).
public struct KybCin: Codable {
    public let input: String
    public let valid: Bool
    public let listingStatus: String?
    public let listingCode: String?
    public let industryCode: String?
    public let stateCode: String?
    public let state: String?
    public let incorporationYear: Int?
    public let companyClassCode: String?
    public let companyClass: String?
    public let registrationNumber: String?

    enum CodingKeys: String, CodingKey {
        case input, valid, state
        case listingStatus = "listing_status"
        case listingCode = "listing_code"
        case industryCode = "industry_code"
        case stateCode = "state_code"
        case incorporationYear = "incorporation_year"
        case companyClassCode = "company_class_code"
        case companyClass = "company_class"
        case registrationNumber = "registration_number"
    }
}

/// `POST /v1/kyb/validate` — only the identifiers you sent come back.
public struct KybValidateResponse: Codable {
    public let status: String
    public let gstin: KybGstin?
    public let pan: KybPan?
    public let cin: KybCin?
}

/// `POST /v1/document/mrz`
public struct MrzChecks: Codable {
    public let documentNumber: Bool
    public let dateOfBirth: Bool
    public let expiryDate: Bool
    public let composite: Bool

    enum CodingKeys: String, CodingKey {
        case composite
        case documentNumber = "document_number"
        case dateOfBirth = "date_of_birth"
        case expiryDate = "expiry_date"
    }
}

public struct MrzResponse: Codable {
    public let valid: Bool
    public let format: String // "TD1" | "TD3"
    public let documentNumber: String
    public let surname: String
    public let givenNames: String
    public let nationality: String
    public let dateOfBirth: String
    public let expiryDate: String
    public let checks: MrzChecks

    enum CodingKeys: String, CodingKey {
        case valid, format, surname, nationality, checks
        case documentNumber = "document_number"
        case givenNames = "given_names"
        case dateOfBirth = "date_of_birth"
        case expiryDate = "expiry_date"
    }
}

/// `GET /v1/billing/balance`
public struct BalanceResponse: Codable {
    public let status: String
    public let clientId: String
    public let balance: Int
    /// false = postpaid/exempt account (calls don't deduct credits).
    public let metered: Bool

    enum CodingKeys: String, CodingKey {
        case status, balance, metered
        case clientId = "client_id"
    }
}

/// One row of `GET /v1/billing/ledger`.
public struct LedgerEntry: Codable {
    public let delta: Int
    public let balanceAfter: Int
    public let reason: String
    public let refId: String?
    public let createdAt: String

    enum CodingKeys: String, CodingKey {
        case delta, reason
        case balanceAfter = "balance_after"
        case refId = "ref_id"
        case createdAt = "created_at"
    }
}

/// `GET /v1/billing/ledger`
public struct LedgerResponse: Codable {
    public let status: String
    public let clientId: String
    public let balance: Int
    public let entries: [LedgerEntry]

    enum CodingKeys: String, CodingKey {
        case status, balance, entries
        case clientId = "client_id"
    }
}

/// One purchasable pack from `GET /v1/billing/packs`.
public struct PackInfo: Codable {
    public let id: String
    public let credits: Int
    public let displayPrice: String?

    enum CodingKeys: String, CodingKey {
        case id, credits
        case displayPrice = "display_price"
    }
}

public struct PacksResponse: Codable {
    public let status: String
    public let packs: [PackInfo]
}

/// `POST /v1/billing/topup` — redirect the customer to `checkoutUrl`.
public struct TopupResponse: Codable {
    public let status: String
    public let pack: String
    public let credits: Int
    public let checkoutUrl: String
    public let sessionId: String

    enum CodingKeys: String, CodingKey {
        case status, pack, credits
        case checkoutUrl = "checkout_url"
        case sessionId = "session_id"
    }
}
