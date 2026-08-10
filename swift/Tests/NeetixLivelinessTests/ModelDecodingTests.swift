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

    func testDocumentIdDecodes() throws {
        let json = """
        {
          "status": "success",
          "aamva": {
            "version": 8, "issuer_id": "636014", "doc_type": "DL",
            "first_name": "JANE", "middle_name": null, "last_name": "DOE",
            "dob": "1986-06-06", "expiry": "2031-06-06", "issue_date": "2023-06-06",
            "license_number": "D1234562",
            "address": {"street": "2570 24TH STREET", "city": "SACRAMENTO",
                        "state": "CA", "postal": "95818"},
            "sex": "F", "height": null, "eye_color": "BRO",
            "country": "USA", "real_id_compliant": true
          },
          "checks": {"barcode_decoded": true, "aamva_parsed": true, "expired": false,
                     "underage_18": false, "underage_21": false, "dates_valid": true},
          "face_found": null,
          "forensics": null,
          "warnings": []
        }
        """.data(using: .utf8)!
        let res = try JSONDecoder().decode(DocumentIdResponse.self, from: json)
        XCTAssertEqual(res.aamva?.version, 8)
        XCTAssertEqual(res.aamva?.issuerId, "636014")
        XCTAssertEqual(res.aamva?.docType, "DL")
        XCTAssertEqual(res.aamva?.firstName, "JANE")
        XCTAssertNil(res.aamva?.middleName)
        XCTAssertEqual(res.aamva?.dob, "1986-06-06")
        XCTAssertEqual(res.aamva?.address?.state, "CA")
        XCTAssertEqual(res.aamva?.realIdCompliant, true)
        XCTAssertTrue(res.checks.barcodeDecoded)
        XCTAssertEqual(res.checks.expired, false)
        XCTAssertNil(res.faceFound)
        XCTAssertNil(res.forensics)
        XCTAssertTrue(res.warnings.isEmpty)
    }

    func testDocumentIdUnreadableBarcodeDecodes() throws {
        let json = """
        {
          "status": "success",
          "aamva": null,
          "checks": {"barcode_decoded": false, "aamva_parsed": false, "expired": null,
                     "underage_18": null, "underage_21": null, "dates_valid": null},
          "face_found": true,
          "forensics": {"screen_replay_score": 0.12, "synthetic_score": 0.03,
                        "high_freq_ratio": 0.4, "spectral_peak": 1.1},
          "warnings": [{"code": "BARCODE_UNREADABLE", "severity": "review",
                        "description": "back image given but no PDF417 decoded"}]
        }
        """.data(using: .utf8)!
        let res = try JSONDecoder().decode(DocumentIdResponse.self, from: json)
        XCTAssertNil(res.aamva)
        XCTAssertFalse(res.checks.barcodeDecoded)
        XCTAssertNil(res.checks.expired)
        XCTAssertEqual(res.faceFound, true)
        XCTAssertEqual(res.forensics?.screenReplayScore ?? 0, 0.12, accuracy: 1e-9)
        XCTAssertEqual(res.warnings.first?.code, "BARCODE_UNREADABLE")
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
