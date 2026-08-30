import Foundation

public struct LivenessResponse: Codable {
    public let status: String
    public let livenessScore: Double
    public let livenessStatus: String
    public let faceCount: Int

    enum CodingKeys: String, CodingKey {
        case status
        case livenessScore = "liveness_score"
        case livenessStatus = "liveness_status"
        case faceCount = "face_count"
    }
}

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

public struct EnrollResponse: Codable {
    public let status: String
    public let enrollmentId: String
    public let userId: String

    enum CodingKeys: String, CodingKey {
        case status
        case enrollmentId = "enrollment_id"
        case userId = "user_id"
    }
}

public struct Warning: Codable {
    public let code: String
    public let severity: String
    public let description: String
}

public struct FaceSignals: Codable {
    public let maskConfidence: Double?
    public let ageBracket: String?
    public let gender: String?
    public let emotion: String?

    enum CodingKeys: String, CodingKey {
        case maskConfidence = "mask_confidence"
        case ageBracket = "age_bracket"
        case gender
        case emotion
    }
}

public struct FaceMatchResult: Codable {
    public let isSameFace: Bool
    public let sameFaceConfidence: Double
    public let livenessScore: Double
    public let livenessStatus: String
    public let spoofDetected: Bool
    public let faceSignals: FaceSignals?

    enum CodingKeys: String, CodingKey {
        case isSameFace = "is_same_face"
        case sameFaceConfidence = "same_face_confidence"
        case livenessScore = "liveness_score"
        case livenessStatus = "liveness_status"
        case spoofDetected = "spoof_detected"
        case faceSignals = "face_signals"
    }
}

public struct FaceMatchResponse: Codable {
    public let status: String
    public let verdict: String
    public let warnings: [Warning]
    public let result: FaceMatchResult
}

public struct MRZChecks: Codable {
    public let documentNumber: Bool
    public let dateOfBirth: Bool
    public let expiryDate: Bool
    public let composite: Bool

    enum CodingKeys: String, CodingKey {
        case documentNumber = "document_number"
        case dateOfBirth = "date_of_birth"
        case expiryDate = "expiry_date"
        case composite
    }
}

public struct MRZResponse: Codable {
    public let valid: Bool
    public let format: String
    public let documentNumber: String
    public let surname: String
    public let givenNames: String
    public let nationality: String
    public let dateOfBirth: String
    public let expiryDate: String
    public let checks: MRZChecks

    enum CodingKeys: String, CodingKey {
        case valid, format, surname, nationality, checks
        case documentNumber = "document_number"
        case givenNames = "given_names"
        case dateOfBirth = "date_of_birth"
        case expiryDate = "expiry_date"
    }
}
