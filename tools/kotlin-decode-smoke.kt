// Decoding smoke test for the Android SDK's response models.
//
// Compiled together with the client sources and run on a plain JVM —
// `just android-smoke`. No Android SDK, no instrumentation, no gradle needed.
// It verifies the thing that actually breaks: @SerialName vs the server's
// snake_case JSON.

import `in`.neetix.liveliness.DeviceAnalyzeResponse
import `in`.neetix.liveliness.FaceEnrollResponse
import `in`.neetix.liveliness.FaceSearchResponse
import `in`.neetix.liveliness.LinkInfoResponse
import `in`.neetix.liveliness.LinkVerifyResponse
import `in`.neetix.liveliness.StreamStartResponse
import `in`.neetix.liveliness.TemplateProtectResponse
import `in`.neetix.liveliness.TemplateVerifyResponse
import `in`.neetix.liveliness.ValidateResponse
import `in`.neetix.liveliness.VerificationKeyResponse
import `in`.neetix.liveliness.WorkflowRunResponse
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonPrimitive

private val json = Json { ignoreUnknownKeys = true }
private var failures = 0

private fun check(label: String, ok: Boolean) {
    println(if (ok) "ok   $label" else "FAIL $label")
    if (!ok) failures++
}

fun main() {
    val search = json.decodeFromString<FaceSearchResponse>(
        """{"status":"success","request_id":"r1","match_count":2,"blocklist_hit":true,
            "matches":[{"subject_id":"s1","confidence":91.2,"cosine_similarity":0.71,
            "blocklisted":true}]}""",
    )
    check(
        "FaceSearchResponse snake_case",
        search.blocklistHit &&
            search.matches.first().subjectId == "s1" &&
            search.matches.first().cosineSimilarity == 0.71,
    )

    val enroll = json.decodeFromString<FaceEnrollResponse>(
        """{"status":"success","enrollment_id":"e1","subject_id":"s1","blocklisted":false}""",
    )
    check("FaceEnrollResponse", enroll.enrollmentId == "e1" && !enroll.blocklisted)

    val tmpl = json.decodeFromString<TemplateProtectResponse>(
        """{"status":"success","version":2,"template":"BASE64","bits":256}""",
    )
    check("TemplateProtectResponse", tmpl.version == 2 && tmpl.template == "BASE64")

    val verify = json.decodeFromString<TemplateVerifyResponse>(
        """{"status":"success","similarity":0.758,"is_match":true,
            "match_threshold":0.6,"revoked":false}""",
    )
    check("TemplateVerifyResponse", verify.isMatch && verify.similarity == 0.758 && !verify.revoked)

    val validate = json.decodeFromString<ValidateResponse>(
        """{"status":"success","fields":{"aadhaar":{"valid":true,"masked":"XXXXXXXX1234"},
            "pan":{"valid":false}}}""",
    )
    check(
        "ValidateResponse open JSON",
        validate.fields["aadhaar"]!!.jsonObject["masked"]!!.jsonPrimitive.content ==
            "XXXXXXXX1234",
    )

    val device = json.decodeFromString<DeviceAnalyzeResponse>(
        """{"status":"success","risk_score":72.5,"risk_level":"high","ip_class":"datacenter",
            "flags":[{"code":"VIRTUAL_CAMERA","weight":30,"description":"virtual camera"}]}""",
    )
    check(
        "DeviceAnalyzeResponse",
        device.riskLevel == "high" &&
            device.ipClass == "datacenter" &&
            device.flags.first().code == "VIRTUAL_CAMERA",
    )

    val wf = json.decodeFromString<WorkflowRunResponse>(
        """{"status":"success","verdict":"review",
            "checks":{"liveness":{"score":81.2},"aml":{"hit":false}}}""",
    )
    check(
        "WorkflowRunResponse",
        !wf.approved &&
            wf.verdict == "review" &&
            (wf.checks["liveness"] as JsonObject)["score"]!!.jsonPrimitive.double == 81.2,
    )

    val stream = json.decodeFromString<StreamStartResponse>(
        """{"status":"success","session_id":"s","stream_url":"wss://x/v1/stream/s",
            "challenges":["center"],"expires_at":"2026-11-01T00:00:00Z",
            "instructions":"hold still"}""",
    )
    check(
        "StreamStartResponse",
        stream.streamUrl.startsWith("wss://") && stream.challenges == listOf("center"),
    )

    val link = json.decodeFromString<LinkVerifyResponse>(
        """{"status":"success","token":"t","request_id":"r",
            "result":{"verdict":"approved","confidence":98.9,"liveness":95.0,
            "warnings":["EDITED_IMAGE"]}}""",
    )
    check(
        "LinkVerifyResponse",
        link.result.verdict == "approved" && link.result.warnings == listOf("EDITED_IMAGE"),
    )

    val info = json.decodeFromString<LinkInfoResponse>(
        """{"status":"pending","label":"KYC for Asha","expired":false,
            "expires_at":"2026-11-03T00:00:00Z"}""",
    )
    check("LinkInfoResponse", info.status == "pending" && info.label == "KYC for Asha")

    val keyOn = json.decodeFromString<VerificationKeyResponse>(
        """{"algorithm":"ed25519","public_key_base64":"AAAA",
            "signed_header":"X-Neetix-Signature"}""",
    )
    val keyOff = json.decodeFromString<VerificationKeyResponse>(
        """{"algorithm":null,"enabled":false}""",
    )
    check(
        "VerificationKeyResponse enabled inference",
        keyOn.signingEnabled && !keyOff.signingEnabled,
    )

    println(
        if (failures == 0) "\nALL KOTLIN DECODING CHECKS PASSED" else "\n$failures FAILED",
    )
    if (failures > 0) {
        throw AssertionError("$failures decoding check(s) failed")
    }
}

// Keeps the unused-import warning away while documenting the dependency.
private val unusedPrimitiveRef: Class<JsonPrimitive> = JsonPrimitive::class.java
