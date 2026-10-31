package `in`.neetix.liveliness

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/** One entry of the risk-policy `warnings[]` array. */
@Serializable
data class ApiWarning(
    val code: String,
    val severity: String, // "decline" | "review"
    val description: String,
)

/**
 * Optional device-attestation evidence for `/v1/face/face-match`,
 * `/v1/liveness` and `/v1/age`. Sent as multipart fields `attest_platform`,
 * `attest_token` (+ `attest_key_id`, iOS only); omit it entirely to keep
 * current behavior. Pair with the request's `capture_nonce` — the token must
 * be bound to it (Android: Play Integrity nonce = base64url(SHA-256(nonce)),
 * see the capture module's `NeetixAttestation`; iOS: App Attest challenge).
 */
data class Attestation(
    val platform: String, // "android" | "ios"
    /** Base64 attestation token (Play Integrity token / App Attest CBOR). */
    val token: String,
    /** App Attest key id — iOS only. */
    val keyId: String? = null,
) {
    companion object {
        /** Play Integrity token from the capture module's `NeetixAttestation`. */
        fun android(token: String) = Attestation("android", token)

        /** Apple App Attest: base64 CBOR attestation object + key id. */
        fun ios(token: String, keyId: String) = Attestation("ios", token, keyId)
    }
}

/**
 * Server-side attestation verdict echoed on face-match / liveness / age
 * responses; null when no attestation evidence was sent. `verified == false`
 * adds an `ATTESTATION_FAILED` warning (severity `review`; `decline` when the
 * server has `[attestation].require` set).
 */
@Serializable
data class AttestationInfo(
    val platform: String = "",
    val verified: Boolean = false,
    val detail: String = "",
)

/** `POST /v1/signup` — [apiKey] is shown ONCE; persist it. */
@Serializable
data class SignupResponse(
    val status: String,
    @SerialName("api_key") val apiKey: String,
    @SerialName("client_id") val clientId: String,
    val credits: Long = 0,
    val message: String = "",
)

/** `POST /v1/liveness` */
@Serializable
data class LivenessResponse(
    val status: String, // "Approved" | "Declined" | "Not Finished"
    @SerialName("liveness_score") val livenessScore: Double,
    @SerialName("liveness_status") val livenessStatus: String,
    @SerialName("face_count") val faceCount: Int = 0,
    val warnings: List<ApiWarning> = emptyList(),
    /** Only when attestation evidence was sent with the request. */
    val attestation: AttestationInfo? = null,
) {
    val approved: Boolean get() = status == "Approved"
}

/**
 * `POST /v1/age` — selfie age estimation. New endpoint: every field is
 * optional/defaulted so decoding stays robust as the shape evolves.
 */
@Serializable
data class AgeCheckResponse(
    val status: String = "",
    @SerialName("age_bracket") val ageBracket: String? = null,
    @SerialName("age_estimate") val estimatedAge: Double? = null,
    @SerialName("is_adult") val isAdult: Boolean? = null,
    val verdict: String? = null,
    val warnings: List<ApiWarning> = emptyList(),
    /** Only when attestation evidence was sent with the request. */
    val attestation: AttestationInfo? = null,
)

@Serializable
data class FaceSignals(
    @SerialName("mask_confidence") val maskConfidence: Double? = null,
    @SerialName("left_eye_open") val leftEyeOpen: Double? = null,
    @SerialName("right_eye_open") val rightEyeOpen: Double? = null,
    @SerialName("age_bracket") val ageBracket: String? = null,
    val gender: String? = null,
    val emotion: String? = null,
)

@Serializable
data class FaceMatchResult(
    @SerialName("is_same_face") val isSameFace: Boolean,
    @SerialName("same_face_confidence") val sameFaceConfidence: Double,
    @SerialName("cosine_similarity") val cosineSimilarity: Double? = null,
    @SerialName("liveness_score") val livenessScore: Double,
    @SerialName("liveness_status") val livenessStatus: String,
    @SerialName("spoof_detected") val spoofDetected: Boolean = false,
    @SerialName("face_signals") val faceSignals: FaceSignals? = null,
    @SerialName("model_version") val modelVersion: String? = null,
)

/** `POST /v1/face/face-match` */
@Serializable
data class FaceMatchResponse(
    val status: String,
    val verdict: String, // "approved" | "review" | "declined"
    val warnings: List<ApiWarning> = emptyList(),
    val result: FaceMatchResult,
    /** Only when attestation evidence was sent with the request. */
    val attestation: AttestationInfo? = null,
) {
    val approved: Boolean get() = verdict == "approved"
}

/** `POST /v1/auth/verify` */
@Serializable
data class AuthVerifyResponse(
    val authenticated: Boolean,
    @SerialName("user_id") val userId: String,
    @SerialName("match_confidence") val matchConfidence: Double,
    @SerialName("liveness_score") val livenessScore: Double,
    @SerialName("liveness_ok") val livenessOk: Boolean,
)

/** `POST /v1/auth/enroll` */
@Serializable
data class EnrollResponse(
    val status: String,
    @SerialName("enrollment_id") val enrollmentId: String? = null,
    @SerialName("user_id") val userId: String? = null,
)

/** `POST /v1/session/start` */
@Serializable
data class SessionStartResponse(
    val status: String,
    @SerialName("session_id") val sessionId: String,
    val challenges: List<String> = emptyList(),
    @SerialName("expires_at") val expiresAt: String = "",
    val instructions: String = "",
)

/** One watchlist hit from `POST /v1/aml/screen`. */
@Serializable
data class AmlMatch(
    @SerialName("matched_name") val matchedName: String,
    val score: Double,
    val list: String,
    val country: String? = null,
    val program: String? = null,
    @SerialName("dob_match") val dobMatch: Boolean? = null,
)

/** `POST /v1/aml/screen` */
@Serializable
data class AmlScreenResponse(
    val status: String,
    val query: String = "",
    @SerialName("screened_against") val screenedAgainst: Long = 0,
    val threshold: Double = 0.0,
    val hit: Boolean,
    val matches: List<AmlMatch> = emptyList(),
)

@Serializable
data class MrzChecks(
    @SerialName("document_number") val documentNumber: Boolean,
    @SerialName("date_of_birth") val dateOfBirth: Boolean,
    @SerialName("expiry_date") val expiryDate: Boolean,
    val composite: Boolean,
)

/** `POST /v1/document/mrz` */
@Serializable
data class MrzResponse(
    val valid: Boolean,
    val format: String, // "TD1" | "TD3"
    @SerialName("document_number") val documentNumber: String,
    val surname: String,
    @SerialName("given_names") val givenNames: String,
    val nationality: String,
    @SerialName("date_of_birth") val dateOfBirth: String,
    @SerialName("expiry_date") val expiryDate: String,
    val checks: MrzChecks,
)

/** Address block inside [AamvaData] from `POST /v1/document/id`. */
@Serializable
data class AamvaAddress(
    val street: String? = null,
    val city: String? = null,
    val state: String? = null,
    val postal: String? = null,
)

/**
 * AAMVA payload decoded from the back-side PDF417 barcode of a US/CA
 * driver's license / state ID. Elements absent from the barcode are null.
 */
@Serializable
data class AamvaData(
    /** AAMVA standard version (1–10). */
    val version: Int? = null,
    /** Issuer Identification Number (IIN, 6 digits). */
    @SerialName("issuer_id") val issuerId: String? = null,
    @SerialName("doc_type") val docType: String? = null, // "DL" | "ID"
    @SerialName("first_name") val firstName: String? = null,
    @SerialName("middle_name") val middleName: String? = null,
    @SerialName("last_name") val lastName: String? = null,
    val dob: String? = null, // "YYYY-MM-DD"
    val expiry: String? = null, // "YYYY-MM-DD"
    @SerialName("issue_date") val issueDate: String? = null,
    @SerialName("license_number") val licenseNumber: String? = null,
    val address: AamvaAddress? = null,
    val sex: String? = null,
    val height: String? = null,
    @SerialName("eye_color") val eyeColor: String? = null,
    val country: String? = null, // "USA" | "CAN"
    @SerialName("real_id_compliant") val realIdCompliant: Boolean? = null,
)

/** Decision inputs derived from the barcode; null = not evaluable. */
@Serializable
data class DocumentIdChecks(
    @SerialName("barcode_decoded") val barcodeDecoded: Boolean = false,
    @SerialName("aamva_parsed") val aamvaParsed: Boolean = false,
    val expired: Boolean? = null,
    @SerialName("underage_18") val underage18: Boolean? = null,
    @SerialName("underage_21") val underage21: Boolean? = null,
    @SerialName("dates_valid") val datesValid: Boolean? = null,
)

/** Front-side screen-replay/tamper forensic signals from `POST /v1/document/id`. */
@Serializable
data class DocumentForensics(
    @SerialName("screen_replay_score") val screenReplayScore: Double? = null,
    @SerialName("synthetic_score") val syntheticScore: Double? = null,
    @SerialName("high_freq_ratio") val highFreqRatio: Double? = null,
    @SerialName("spectral_peak") val spectralPeak: Double? = null,
)

/**
 * `POST /v1/document/id` — DL/state-ID parsing: back-side PDF417 → AAMVA
 * ([aamva] + [checks]), optional front-side face detection ([faceFound]) +
 * document forensics ([forensics]). Warning codes: `DOCUMENT_EXPIRED`,
 * `DOCUMENT_UNDERAGE_18`, `DOCUMENT_UNDERAGE_21`, `BARCODE_UNREADABLE`,
 * `DOCUMENT_SCREEN_REPLAY`, `DOCUMENT_TAMPER`.
 */
@Serializable
data class DocumentIdResponse(
    val status: String = "",
    /** Null when the barcode couldn't be decoded/parsed. */
    val aamva: AamvaData? = null,
    val checks: DocumentIdChecks = DocumentIdChecks(),
    /** Only when a `front` image was sent; null otherwise. */
    @SerialName("face_found") val faceFound: Boolean? = null,
    /** Front-side screen-replay/tamper signals; null without a `front` image. */
    val forensics: DocumentForensics? = null,
    val warnings: List<ApiWarning> = emptyList(),
)

/** `GET /v1/billing/balance` */
@Serializable
data class BalanceResponse(
    val status: String,
    @SerialName("client_id") val clientId: String,
    val balance: Long,
    /** false = postpaid/exempt account (calls don't deduct credits). */
    val metered: Boolean,
)

/** One row of `GET /v1/billing/ledger`. */
@Serializable
data class LedgerEntry(
    val delta: Long,
    @SerialName("balance_after") val balanceAfter: Long,
    val reason: String,
    @SerialName("ref_id") val refId: String? = null,
    @SerialName("created_at") val createdAt: String = "",
)

/** `GET /v1/billing/ledger` */
@Serializable
data class LedgerResponse(
    val status: String,
    @SerialName("client_id") val clientId: String,
    val balance: Long,
    val entries: List<LedgerEntry> = emptyList(),
)

/** One purchasable pack from `GET /v1/billing/packs`. */
@Serializable
data class PackInfo(
    val id: String,
    val credits: Long,
    @SerialName("display_price") val displayPrice: String? = null,
)

@Serializable
data class PacksResponse(val status: String, val packs: List<PackInfo> = emptyList())

/** `POST /v1/billing/topup` — redirect the customer to [checkoutUrl]. */
@Serializable
data class TopupResponse(
    val status: String,
    val pack: String,
    val credits: Long,
    @SerialName("checkout_url") val checkoutUrl: String,
    @SerialName("session_id") val sessionId: String,
)

/**
 * API error: HTTP [statusCode] plus the stable machine-readable
 * [messageCode] from the error envelope (e.g. `unauthorized`,
 * `no_face_detected`, `insufficient_credits`). [body] is the raw JSON
 * error envelope, when one was parseable.
 */
class NeetixApiException(
    val statusCode: Int,
    override val message: String,
    val messageCode: String? = null,
    val body: JsonObject? = null,
) : Exception(message) {
    /** True when the prepaid balance is exhausted (HTTP 402). */
    val isInsufficientCredits: Boolean
        get() = statusCode == 402 || messageCode == "insufficient_credits"
}

// ---------- Gallery (1:N face search) ----------

/** `POST /v1/face/enroll` */
@Serializable
data class FaceEnrollResponse(
    val status: String,
    @SerialName("enrollment_id") val enrollmentId: String? = null,
    @SerialName("subject_id") val subjectId: String? = null,
    val blocklisted: Boolean = false,
)

/** One ranked gallery hit from `POST /v1/face/search`. */
@Serializable
data class GalleryMatch(
    @SerialName("subject_id") val subjectId: String,
    val confidence: Double = 0.0,
    @SerialName("cosine_similarity") val cosineSimilarity: Double = 0.0,
    val blocklisted: Boolean = false,
)

/** `POST /v1/face/search` — best match first. */
@Serializable
data class FaceSearchResponse(
    val status: String,
    @SerialName("request_id") val requestId: String? = null,
    @SerialName("match_count") val matchCount: Int = 0,
    /** True when a blocklisted subject cleared the match threshold. */
    @SerialName("blocklist_hit") val blocklistHit: Boolean = false,
    val matches: List<GalleryMatch> = emptyList(),
)

// ---------- Revocable templates (ISO/IEC 24745) ----------

/** `POST /v1/template/protect` — store [template], never a raw embedding. */
@Serializable
data class TemplateProtectResponse(
    val status: String,
    val version: Int = 0,
    /** Base64 non-invertible template. */
    val template: String,
    val bits: Int = 0,
)

/** `POST /v1/template/verify` — [revoked] when the key versions differ. */
@Serializable
data class TemplateVerifyResponse(
    val status: String,
    val similarity: Double = 0.0,
    @SerialName("is_match") val isMatch: Boolean = false,
    @SerialName("match_threshold") val matchThreshold: Double = 0.0,
    val revoked: Boolean = false,
)

// ---------- Validation ----------

/**
 * `POST /v1/validate/identity` and `POST /v1/validate/contact` — only the
 * fields you submitted appear in [fields]. Aadhaar is echoed MASKED only.
 */
@Serializable
data class ValidateResponse(
    val status: String,
    val fields: JsonObject,
)

// ---------- Device & IP risk ----------

/** One scored signal from `POST /v1/device/analyze`. */
@Serializable
data class DeviceFlag(
    val code: String,
    val weight: Double = 0.0,
    val description: String = "",
)

/** `POST /v1/device/analyze` */
@Serializable
data class DeviceAnalyzeResponse(
    val status: String,
    @SerialName("risk_score") val riskScore: Double = 0.0,
    @SerialName("risk_level") val riskLevel: String = "",
    @SerialName("ip_class") val ipClass: String? = null,
    val flags: List<DeviceFlag> = emptyList(),
)

// ---------- Workflows ----------

/** `POST /v1/workflow/run` — one entry in [checks] per requested check. */
@Serializable
data class WorkflowRunResponse(
    val status: String,
    val verdict: String = "",
    val checks: JsonObject,
) {
    val approved: Boolean get() = verdict == "approved"
}

// ---------- Continuous liveliness (V-CIP) ----------

/** `POST /v1/stream/start` — open [streamUrl] as a WebSocket and push frames. */
@Serializable
data class StreamStartResponse(
    val status: String,
    @SerialName("session_id") val sessionId: String,
    @SerialName("stream_url") val streamUrl: String,
    val challenges: List<String> = emptyList(),
    @SerialName("expires_at") val expiresAt: String? = null,
    val instructions: String? = null,
)

// ---------- Hosted verification links ----------

/** The compact result stored on a completed link. */
@Serializable
data class LinkCompactResult(
    val verdict: String = "",
    val confidence: Double = 0.0,
    val liveness: Double = 0.0,
    /** Warning codes only (not full [ApiWarning] objects). */
    val warnings: List<String> = emptyList(),
)

/** `GET /v1/links/{token}` — public; the token is the capability. */
@Serializable
data class LinkInfoResponse(
    /** "pending" | "completed" | "expired" */
    val status: String,
    val label: String? = null,
    val expired: Boolean = false,
    @SerialName("expires_at") val expiresAt: String? = null,
)

/** `POST /v1/links/{token}/verify` — public; charges the link OWNER. */
@Serializable
data class LinkVerifyResponse(
    val status: String,
    val token: String? = null,
    @SerialName("request_id") val requestId: String? = null,
    val result: LinkCompactResult = LinkCompactResult(),
)

// ---------- Response signing ----------

/**
 * `GET /v1/verification-key` — the Ed25519 key that signs face-match response
 * bodies (detached signature in `X-Neetix-Signature`). The endpoint omits
 * [enabled] when signing IS configured; use [signingEnabled].
 */
@Serializable
data class VerificationKeyResponse(
    val algorithm: String? = null,
    @SerialName("public_key_base64") val publicKeyBase64: String? = null,
    @SerialName("signed_header") val signedHeader: String? = null,
    val enabled: Boolean? = null,
) {
    val signingEnabled: Boolean get() = enabled ?: (algorithm != null)
}
