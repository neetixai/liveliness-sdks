import XCTest
@testable import NeetixLiveliness

final class ModelDecodingTests: XCTestCase {
    func testDecodesLivenessResponse() throws {
        let json = """
        { "status": "Approved", "liveness_score": 88.43,
          "liveness_status": "genuine", "face_count": 1 }
        """.data(using: .utf8)!
        let r = try JSONDecoder().decode(LivenessResponse.self, from: json)
        XCTAssertEqual(r.status, "Approved")
        XCTAssertEqual(r.livenessScore, 88.43, accuracy: 0.001)
        XCTAssertEqual(r.faceCount, 1)
    }

    func testDecodesAuthVerify() throws {
        let json = """
        { "status": "success", "authenticated": true, "user_id": "usr_rob",
          "match_confidence": 86.44, "match_threshold": 70.0,
          "liveness_score": 96.8, "liveness_ok": true }
        """.data(using: .utf8)!
        let r = try JSONDecoder().decode(AuthVerifyResponse.self, from: json)
        XCTAssertTrue(r.authenticated)
        XCTAssertEqual(r.userId, "usr_rob")
        XCTAssertEqual(r.matchConfidence, 86.44, accuracy: 0.001)
    }

    func testDecodesMRZ() throws {
        let json = """
        { "status": "success", "valid": true, "format": "TD3",
          "document_number": "L898902C3", "surname": "ERIKSSON",
          "given_names": "ANNA MARIA", "nationality": "UTO",
          "date_of_birth": "740812", "sex": "F", "expiry_date": "120415",
          "checks": { "document_number": true, "date_of_birth": true,
                      "expiry_date": true, "composite": true } }
        """.data(using: .utf8)!
        let r = try JSONDecoder().decode(MRZResponse.self, from: json)
        XCTAssertTrue(r.valid)
        XCTAssertEqual(r.surname, "ERIKSSON")
        XCTAssertEqual(r.givenNames, "ANNA MARIA")
        XCTAssertTrue(r.checks.composite)
    }
}
