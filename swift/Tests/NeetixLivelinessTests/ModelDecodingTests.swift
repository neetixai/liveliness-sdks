import XCTest
@testable import NeetixLiveliness

final class ModelDecodingTests: XCTestCase {
    func testFaceMatchDecodes() throws {
        let json = """
        {
          "status": "success",
          "verdict": "review",
          "warnings": [
            {"code": "LOW_LIVENESS_SCORE", "severity": "review", "description": "low"}
          ],
          "result": {
            "is_same_face": true,
            "same_face_confidence": 0.93,
            "liveness_score": 0.41,
            "liveness_status": "uncertain",
            "spoof_detected": false,
            "face_signals": {"age_bracket": "25-32", "gender": "male"}
          }
        }
        """.data(using: .utf8)!
        let res = try JSONDecoder().decode(FaceMatchResponse.self, from: json)
        XCTAssertFalse(res.approved)
        XCTAssertTrue(res.result.isSameFace)
        XCTAssertEqual(res.warnings.first?.code, "LOW_LIVENESS_SCORE")
        XCTAssertEqual(res.result.faceSignals?.ageBracket, "25-32")
    }

    func testAmlScreenDecodes() throws {
        let json = """
        {
          "status": "success", "query": "JOHN DOE", "screened_against": 18000,
          "threshold": 0.85, "hit": true,
          "matches": [{"matched_name": "JOHN DOE", "score": 0.91, "list": "OFAC-SDN",
                       "country": null, "program": "SDGT", "dob_match": null}]
        }
        """.data(using: .utf8)!
        let res = try JSONDecoder().decode(AmlScreenResponse.self, from: json)
        XCTAssertTrue(res.hit)
        XCTAssertEqual(res.matches.first?.list, "OFAC-SDN")
    }

    func testKybValidateDecodes() throws {
        let json = """
        {
          "status": "success",
          "pan": {"input": "AAACR5055K", "valid": true,
                  "entity_type_code": "C", "entity_type": "Company"}
        }
        """.data(using: .utf8)!
        let res = try JSONDecoder().decode(KybValidateResponse.self, from: json)
        XCTAssertEqual(res.pan?.entityType, "Company")
        XCTAssertNil(res.gstin)
        XCTAssertNil(res.cin)
    }

    func testBalanceDecodes() throws {
        let json = """
        {"status": "success", "client_id": "cl_abc", "balance": 498, "metered": true}
        """.data(using: .utf8)!
        let res = try JSONDecoder().decode(BalanceResponse.self, from: json)
        XCTAssertEqual(res.balance, 498)
        XCTAssertTrue(res.metered)
    }

    func testInsufficientCreditsFlag() {
        let err = NeetixError.api(
            status: 402, messageCode: "insufficient_credits",
            message: "insufficient credits", body: Data()
        )
        XCTAssertTrue(err.isInsufficientCredits)
    }
}
