// Decoding smoke test for the Swift SDK's response models.
//
// XCTest is unavailable in the bare Swift toolchain (it needs Xcode), so this
// file is compiled TOGETHER with the library sources and run as a plain
// executable — `just swift-smoke`. It verifies the thing that actually breaks:
// CodingKeys vs the server's snake_case JSON.

import Foundation

@main
struct DecodeSmoke {
    static var failures = 0

    static func decode<T: Decodable>(_ json: String, _ type: T.Type) throws -> T {
        try JSONDecoder().decode(type, from: Data(json.utf8))
    }

    static func check(_ label: String, _ ok: Bool) {
        print(ok ? "ok   \(label)" : "FAIL \(label)")
        if !ok { failures += 1 }
    }

    static func main() throws {
        let search = try decode(
            """
            {"status":"success","request_id":"r1","match_count":2,"blocklist_hit":true,
             "matches":[{"subject_id":"s1","confidence":91.2,"cosine_similarity":0.71,
             "blocklisted":true}]}
            """, FaceSearchResponse.self)
        check(
            "FaceSearchResponse snake_case",
            search.blocklistHit == true
                && search.matches.first?.subjectId == "s1"
                && search.matches.first?.cosineSimilarity == 0.71)

        let enroll = try decode(
            """
            {"status":"success","enrollment_id":"e1","subject_id":"s1","blocklisted":false}
            """, FaceEnrollResponse.self)
        check("FaceEnrollResponse", enroll.enrollmentId == "e1" && enroll.blocklisted == false)

        let tmpl = try decode(
            """
            {"status":"success","version":2,"template":"BASE64","bits":256}
            """, TemplateProtectResponse.self)
        check("TemplateProtectResponse", tmpl.version == 2 && tmpl.template == "BASE64")

        let verify = try decode(
            """
            {"status":"success","similarity":0.758,"is_match":true,"match_threshold":0.6,
             "revoked":false}
            """, TemplateVerifyResponse.self)
        check(
            "TemplateVerifyResponse",
            verify.isMatch && verify.similarity == 0.758 && !verify.revoked)

        let validate = try decode(
            """
            {"status":"success","fields":{"aadhaar":{"valid":true,"masked":"XXXXXXXX1234"},
             "pan":{"valid":false}}}
            """, ValidateResponse.self)
        check(
            "ValidateResponse open JSON",
            validate.fields["aadhaar"]?.objectValue?["masked"]?.stringValue == "XXXXXXXX1234"
                && validate.fields["pan"]?.objectValue?["valid"]?.boolValue == false)

        let device = try decode(
            """
            {"status":"success","risk_score":72.5,"risk_level":"high","ip_class":"datacenter",
             "flags":[{"code":"VIRTUAL_CAMERA","weight":30,"description":"virtual camera"}]}
            """, DeviceAnalyzeResponse.self)
        check(
            "DeviceAnalyzeResponse",
            device.riskLevel == "high" && device.ipClass == "datacenter"
                && device.flags.first?.code == "VIRTUAL_CAMERA")

        let workflow = try decode(
            """
            {"status":"success","verdict":"review","checks":{"liveness":{"score":81.2},
             "aml":{"hit":false}}}
            """, WorkflowRunResponse.self)
        check(
            "WorkflowRunResponse",
            !workflow.approved && workflow.verdict == "review"
                && workflow.checks["liveness"]?.objectValue?["score"]?.numberValue == 81.2)

        let stream = try decode(
            """
            {"status":"success","session_id":"s","stream_url":"wss://x/v1/stream/s",
             "challenges":["center"],"expires_at":"2026-11-01T00:00:00Z",
             "instructions":"hold still"}
            """, StreamStartResponse.self)
        check(
            "StreamStartResponse",
            stream.streamUrl.hasPrefix("wss://") && stream.challenges == ["center"])

        let link = try decode(
            """
            {"status":"success","token":"t","request_id":"r","result":{"verdict":"approved",
             "confidence":98.9,"liveness":95.0,"warnings":["EDITED_IMAGE"]}}
            """, LinkVerifyResponse.self)
        check(
            "LinkVerifyResponse",
            link.result.verdict == "approved" && link.result.warnings == ["EDITED_IMAGE"])

        let info = try decode(
            """
            {"status":"pending","label":"KYC for Asha","expired":false,
             "expires_at":"2026-11-03T00:00:00Z"}
            """, LinkInfoResponse.self)
        check("LinkInfoResponse", info.status == "pending" && info.label == "KYC for Asha")

        let keyOn = try decode(
            """
            {"algorithm":"ed25519","public_key_base64":"AAAA",
             "signed_header":"X-Neetix-Signature"}
            """, VerificationKeyResponse.self)
        let keyOff = try decode(
            #"{"algorithm":null,"enabled":false}"#, VerificationKeyResponse.self)
        check(
            "VerificationKeyResponse enabled inference",
            keyOn.signingEnabled && !keyOff.signingEnabled)

        print(failures == 0 ? "\nALL SWIFT DECODING CHECKS PASSED" : "\n\(failures) FAILED")
        if failures > 0 { exit(1) }
    }
}
