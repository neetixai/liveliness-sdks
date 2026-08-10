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
 * KYB 2, others 1). An exhausted balance throws [NeetixApiException] with
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

    /** Passive liveliness on a single selfie. Cost: 1 credit. */
    suspend fun liveness(person: ByteArray): LivenessResponse =
        postMultipart("/v1/liveness", mapOf("person" to person))

    /**
     * Face match + liveliness (selfie vs ID/reference). Cost: 2 credits.
     * Inspect [FaceMatchResponse.verdict] and [FaceMatchResponse.warnings].
     */
    suspend fun faceMatch(
        person: ByteArray,
        card: ByteArray,
        clientRefId: String? = null,
        customerId: String? = null,
        extraFields: Map<String, String> = emptyMap(),
    ): FaceMatchResponse {
        val fields = buildMap {
            clientRefId?.let { put("client_ref_id", it) }
            customerId?.let { put("customer_id", it) }
            putAll(extraFields)
        }
        return postMultipart("/v1/face/face-match", mapOf("person" to person, "card" to card), fields)
    }

    /**
     * Selfie age estimation. Cost: 1 credit.
     * New endpoint — older deployments return 404 (`messageCode: "not_found"`).
     */
    suspend fun ageCheck(person: ByteArray): AgeCheckResponse =
        postMultipart("/v1/age", mapOf("person" to person))

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

    private suspend inline fun <reified T> postMultipart(
        path: String,
        images: Map<String, ByteArray>,
        fields: Map<String, String> = emptyMap(),
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
            .apply { apiKey?.let { header("Authorization", "Bearer $it") } }
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

    private suspend inline fun <reified T> getJson(path: String): T =
        withContext(Dispatchers.IO) {
            val req = Request.Builder().url("$base$path")
                .apply { apiKey?.let { header("Authorization", "Bearer $it") } }
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
