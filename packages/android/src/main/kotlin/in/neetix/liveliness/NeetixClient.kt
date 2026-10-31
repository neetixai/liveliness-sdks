package `in`.neetix.liveliness

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

const val DEFAULT_BASE_URL = "https://liveliness.neetix.in"

/**
 * Neetix Liveliness API client for Android (OkHttp + kotlinx-serialization).
 *
 * Capture image bytes with CameraX (`ImageCapture`) and pass the JPEG
 * [ByteArray] to these suspend functions. All calls run on [Dispatchers.IO].
 *
 * Every billable call deducts prepaid credits (face-match 2, stream 5,
 * KYB 2, document-id 2, others 1). An exhausted balance throws [NeetixApiException] with
 * `statusCode == 402` / `messageCode == "insufficient_credits"`.
 */
class NeetixClient(
    baseUrl: String = DEFAULT_BASE_URL,
    private val apiKey: String? = null,
    private val http: OkHttpClient = OkHttpClient(),
) {
    private val base = baseUrl.trimEnd('/')
    private val json = Json { ignoreUnknownKeys = true }

    // ---------- Account ----------

    /**
     * Self-serve trial signup — no auth needed. Grants 500 free credits.
     * The returned [SignupResponse.apiKey] is shown ONCE; persist it.
     */
    suspend fun signup(email: String): SignupResponse =
        postJson("/v1/signup", buildJsonObject { put("email", email) }, auth = false)

    // ---------- Face & liveliness ----------

    /**
     * Passive liveliness on a single selfie. Cost: 1 credit.
     *
     * [captureNonce] + [attestation] optionally bind the capture to a device
     * attestation (Play Integrity / App Attest) — see [Attestation]. The
     * response then carries [LivenessResponse.attestation].
     */
    suspend fun liveness(
        person: ByteArray,
        captureNonce: String? = null,
        attestation: Attestation? = null,
    ): LivenessResponse = postMultipart(
        "/v1/liveness",
        mapOf("person" to person),
        attestationFields(captureNonce, attestation),
    )

    /**
     * Face match + liveliness (selfie vs ID/reference). Cost: 2 credits.
     * Inspect [FaceMatchResponse.verdict] and [FaceMatchResponse.warnings].
     *
     * [captureNonce] + [attestation] optionally bind the capture to a device
     * attestation (Play Integrity / App Attest) — see [Attestation].
     */
    suspend fun faceMatch(
        person: ByteArray,
        card: ByteArray,
        clientRefId: String? = null,
        customerId: String? = null,
        captureNonce: String? = null,
        attestation: Attestation? = null,
        extraFields: Map<String, String> = emptyMap(),
    ): FaceMatchResponse {
        val fields = buildMap {
            clientRefId?.let { put("client_ref_id", it) }
            customerId?.let { put("customer_id", it) }
            putAll(attestationFields(captureNonce, attestation))
            putAll(extraFields)
        }
        return postMultipart("/v1/face/face-match", mapOf("person" to person, "card" to card), fields)
    }

    /**
     * Selfie age estimation. Cost: 1 credit.
     * New endpoint — older deployments return 404 (`messageCode: "not_found"`).
     *
     * [captureNonce] + [attestation] optionally bind the capture to a device
     * attestation (Play Integrity / App Attest) — see [Attestation].
     */
    suspend fun ageCheck(
        person: ByteArray,
        captureNonce: String? = null,
        attestation: Attestation? = null,
    ): AgeCheckResponse = postMultipart(
        "/v1/age",
        mapOf("person" to person),
        attestationFields(captureNonce, attestation),
    )

    // ---------- Active-challenge liveliness ----------

    /** Start an active-challenge liveliness session. */
    suspend fun sessionStart(): SessionStartResponse =
        postMultipart("/v1/session/start", emptyMap())

    /** Submit the ordered challenge frames (`frame_0, frame_1, …`) as raw JSON. */
    suspend fun sessionVerify(sessionId: String, frames: List<ByteArray>): JsonObject =
        postMultipart(
            "/v1/session/$sessionId/verify",
            frames.withIndex().associate { (i, f) -> "frame_$i" to f },
        )

    // ---------- Biometric auth ----------

    /** Enroll a user's face for biometric authentication. */
    suspend fun authEnroll(userId: String, person: ByteArray): EnrollResponse =
        postMultipart("/v1/auth/enroll", mapOf("person" to person), mapOf("user_id" to userId))

    /** Authenticate a returning user by face + liveliness. */
    suspend fun authVerify(userId: String, person: ByteArray): AuthVerifyResponse =
        postMultipart("/v1/auth/verify", mapOf("person" to person), mapOf("user_id" to userId))

    // ---------- Screening & documents ----------

    /**
     * AML / sanctions & PEP screening by name (+ optional [dob] "YYYY-MM-DD").
     * Cost: 1 credit.
     */
    suspend fun amlScreen(
        name: String,
        dob: String? = null,
        threshold: Double? = null,
    ): AmlScreenResponse = postJson(
        "/v1/aml/screen",
        buildJsonObject {
            put("name", name)
            dob?.let { put("dob", it) }
            threshold?.let { put("threshold", it) }
        },
    )

    /**
     * KYB: validate Indian business identifiers (GSTIN / PAN / CIN) as raw
     * JSON — only the identifiers you send come back. Cost: 2 credits.
     */
    suspend fun kybValidate(
        gstin: String? = null,
        pan: String? = null,
        cin: String? = null,
    ): JsonObject = postJson(
        "/v1/kyb/validate",
        buildJsonObject {
            gstin?.let { put("gstin", it) }
            pan?.let { put("pan", it) }
            cin?.let { put("cin", it) }
        },
    )

    /** Parse + checksum-validate a passport/ID MRZ (2 or 3 lines). Cost: 1 credit. */
    suspend fun mrzParse(mrz: String): MrzResponse =
        postJson("/v1/document/mrz", buildJsonObject { put("mrz", mrz) })

    /**
     * US/CA driver's-license / state-ID parsing. [back] (the side with the
     * PDF417 barcode) is decoded and AAMVA-parsed into
     * [DocumentIdResponse.aamva] + [DocumentIdResponse.checks]; [front]
     * (portrait side) runs face detection + document forensics. Send at
     * least one image (400 otherwise). A back image with no readable barcode
     * is NOT an error: you get a 200 with `checks.barcodeDecoded == false`
     * and a `BARCODE_UNREADABLE` warning. Cost: 2 credits.
     */
    suspend fun documentId(
        back: ByteArray? = null,
        front: ByteArray? = null,
    ): DocumentIdResponse = postMultipart(
        "/v1/document/id",
        buildMap {
            back?.let { put("back", it) }
            front?.let { put("front", it) }
        },
    )

    // ---------- Gallery (1:N face search) ----------

    /**
     * Enroll a face in the tenant's 1:N gallery under [subjectId].
     * [blocklisted] subjects flag future [faceSearch] hits. Cost: 1 credit.
     */
    suspend fun faceEnroll(
        subjectId: String,
        person: ByteArray,
        blocklisted: Boolean = false,
    ): FaceEnrollResponse = postMultipart(
        "/v1/face/enroll",
        mapOf("person" to person),
        buildMap {
            put("subject_id", subjectId)
            if (blocklisted) put("blocklisted", "true")
        },
    )

    /**
     * Search the tenant gallery for the closest enrolled subjects (best
     * first). Check [FaceSearchResponse.blocklistHit] for dedupe/blocklist
     * flows. Cost: 1 credit.
     */
    suspend fun faceSearch(person: ByteArray, topK: Int = 5): FaceSearchResponse =
        postMultipart(
            "/v1/face/search",
            mapOf("person" to person),
            mapOf("top_k" to topK.toString()),
        )

    // ---------- Revocable templates ----------

    /**
     * Turn a face into a revocable, non-invertible template (ISO/IEC 24745).
     * Store [TemplateProtectResponse.template] instead of an embedding —
     * bumping [keyVersion] revokes every template issued under the old
     * version. Cost: 1 credit.
     */
    suspend fun templateProtect(
        person: ByteArray,
        keyVersion: Int = 1,
    ): TemplateProtectResponse = postMultipart(
        "/v1/template/protect",
        mapOf("person" to person),
        mapOf("key_version" to keyVersion.toString()),
    )

    /**
     * Compare two protected templates. Templates from different key versions
     * never match ([TemplateVerifyResponse.revoked] is true). Cost: 1 credit.
     */
    suspend fun templateVerify(
        templateA: String,
        templateB: String,
    ): TemplateVerifyResponse = postJson(
        "/v1/template/verify",
        buildJsonObject {
            put("template_a", templateA)
            put("template_b", templateB)
        },
    )

    // ---------- Validation ----------

    /**
     * Format + checksum validation for Indian identity numbers (Aadhaar via
     * Verhoeff, PAN, Voter ID, DL). Aadhaar comes back MASKED only.
     * Cost: 1 credit.
     */
    suspend fun validateIdentity(
        aadhaar: String? = null,
        pan: String? = null,
        voter: String? = null,
        dl: String? = null,
    ): ValidateResponse = postJson(
        "/v1/validate/identity",
        buildJsonObject {
            aadhaar?.let { put("aadhaar", it) }
            pan?.let { put("pan", it) }
            voter?.let { put("voter", it) }
            dl?.let { put("dl", it) }
        },
    )

    /**
     * Email validation (disposable / role-based flags) and phone
     * normalization to E.164. Cost: 1 credit.
     */
    suspend fun validateContact(
        email: String? = null,
        phone: String? = null,
    ): ValidateResponse = postJson(
        "/v1/validate/contact",
        buildJsonObject {
            email?.let { put("email", it) }
            phone?.let { put("phone", it) }
        },
    )

    // ---------- Device & IP risk ----------

    /**
     * Score device-integrity and network signals (emulator, root, tampering,
     * virtual camera, VPN/proxy/Tor/datacenter IP) into a risk score + flags.
     * Your app collects the signals; this SDK forwards them. Cost: 1 credit.
     */
    suspend fun deviceAnalyze(signals: JsonObject): DeviceAnalyzeResponse =
        postJson("/v1/device/analyze", signals)

    // ---------- Workflows ----------

    /**
     * Run several checks in one call and get a single folded verdict. Pass
     * either inline [checks] or a saved [workflowId] (inline wins). Supply
     * only the parts the requested checks need. Cost: 3 credits.
     */
    suspend fun workflowRun(
        checks: List<String>? = null,
        workflowId: String? = null,
        person: ByteArray? = null,
        card: ByteArray? = null,
        mrz: String? = null,
        name: String? = null,
        dob: String? = null,
        device: JsonObject? = null,
    ): WorkflowRunResponse = postMultipart(
        "/v1/workflow/run",
        buildMap {
            person?.let { put("person", it) }
            card?.let { put("card", it) }
        },
        buildMap {
            if (!checks.isNullOrEmpty()) {
                put("checks", checks.joinToString(","))
            } else {
                workflowId?.let { put("workflow_id", it) }
            }
            mrz?.let { put("mrz", it) }
            name?.let { put("name", it) }
            dob?.let { put("dob", it) }
            device?.let { put("device", it.toString()) }
        },
    )

    // ---------- Continuous liveliness (V-CIP) ----------

    /**
     * Start a continuous-liveliness stream session. Open
     * [StreamStartResponse.streamUrl] as a WebSocket and push JPEG frames;
     * the server answers with per-frame updates and a final verdict.
     * Cost: 5 credits.
     */
    suspend fun streamStart(): StreamStartResponse =
        postMultipart("/v1/stream/start", emptyMap())

    // ---------- Hosted verification links ----------

    /**
     * Public link status — no auth, the token is the capability (rate limited
     * per IP, 30/hour). Use it to build your own applicant screen.
     */
    suspend fun linkInfo(token: String): LinkInfoResponse =
        getJson("/v1/links/$token", auth = false)

    /**
     * Complete a link as the end user (public, no auth): selfie + ID run the
     * standard face-match pipeline and the link OWNER is charged. Single-use
     * — a duplicate answers 410 `link_gone`; a bad-image 422 keeps the link
     * pending so the user can retry.
     */
    suspend fun linkVerify(
        token: String,
        person: ByteArray,
        card: ByteArray,
    ): LinkVerifyResponse = postMultipart(
        "/v1/links/$token/verify",
        mapOf("person" to person, "card" to card),
        auth = false,
    )

    // ---------- Response signing ----------

    /**
     * The Ed25519 public key that signs face-match response bodies (detached
     * signature in the `X-Neetix-Signature` header). Public — no auth.
     */
    suspend fun verificationKey(): VerificationKeyResponse =
        getJson("/v1/verification-key", auth = false)

    // ---------- Billing (prepaid credits) ----------

    /** Current prepaid-credit balance. */
    suspend fun balance(): BalanceResponse = getJson("/v1/billing/balance")

    /** Credit ledger, newest first. */
    suspend fun ledger(limit: Int = 50): LedgerResponse =
        getJson("/v1/billing/ledger?limit=$limit")

    /** Purchasable credit packs. */
    suspend fun packs(): PacksResponse = getJson("/v1/billing/packs")

    /** Create a hosted-checkout top-up; open [TopupResponse.checkoutUrl]. */
    suspend fun topup(pack: String, email: String? = null): TopupResponse = postJson(
        "/v1/billing/topup",
        buildJsonObject {
            put("pack", pack)
            email?.let { put("email", it) }
        },
    )

    // ---------- Transport ----------

    /**
     * Optional attestation multipart fields (`capture_nonce`,
     * `attest_platform`, `attest_token`, `attest_key_id`). Empty when both
     * args are null — absent fields keep current server behavior.
     */
    private fun attestationFields(
        captureNonce: String?,
        attestation: Attestation?,
    ): Map<String, String> = buildMap {
        captureNonce?.let { put("capture_nonce", it) }
        attestation?.let {
            put("attest_platform", it.platform)
            put("attest_token", it.token)
            it.keyId?.let { keyId -> put("attest_key_id", keyId) }
        }
    }

    private suspend inline fun <reified T> postMultipart(
        path: String,
        images: Map<String, ByteArray>,
        fields: Map<String, String> = emptyMap(),
        auth: Boolean = true,
    ): T = withContext(Dispatchers.IO) {
        // OkHttp's MultipartBody requires >= 1 part; the API accepts a bare
        // empty POST for part-less endpoints (e.g. /v1/session/start).
        val body = if (images.isEmpty() && fields.isEmpty()) {
            ByteArray(0).toRequestBody(null)
        } else {
            val builder = MultipartBody.Builder().setType(MultipartBody.FORM)
            fields.forEach { (k, v) -> builder.addFormDataPart(k, v) }
            images.forEach { (name, bytes) ->
                builder.addFormDataPart(
                    name, "image.jpg",
                    bytes.toRequestBody("image/jpeg".toMediaType()),
                )
            }
            builder.build()
        }
        val req = Request.Builder().url("$base$path")
            .apply { if (auth) apiKey?.let { header("Authorization", "Bearer $it") } }
            .post(body).build()
        decode(req)
    }

    private suspend inline fun <reified T> postJson(
        path: String,
        body: JsonObject,
        auth: Boolean = true,
    ): T = withContext(Dispatchers.IO) {
        val req = Request.Builder().url("$base$path")
            .apply { if (auth) apiKey?.let { header("Authorization", "Bearer $it") } }
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .build()
        decode(req)
    }

    private suspend inline fun <reified T> getJson(
        path: String,
        auth: Boolean = true,
    ): T =
        withContext(Dispatchers.IO) {
            val req = Request.Builder().url("$base$path")
                .apply { if (auth) apiKey?.let { header("Authorization", "Bearer $it") } }
                .get().build()
            decode(req)
        }

    private inline fun <reified T> decode(req: Request): T {
        http.newCall(req).execute().use { res ->
            val text = res.body?.string().orEmpty()
            if (!res.isSuccessful) {
                val envelope = runCatching {
                    json.parseToJsonElement(text) as? JsonObject
                }.getOrNull()
                // Standard envelope carries `message` + `message_code`; face-match
                // domain errors carry a Digitap-style `error` string instead.
                val message = (envelope?.get("message") as? JsonPrimitive)?.contentOrNull
                    ?: (envelope?.get("error") as? JsonPrimitive)?.contentOrNull
                    ?: "HTTP ${res.code}"
                throw NeetixApiException(
                    statusCode = res.code,
                    message = message,
                    messageCode = (envelope?.get("message_code") as? JsonPrimitive)?.contentOrNull,
                    body = envelope,
                )
            }
            return json.decodeFromString(text)
        }
    }
}
