package `in`.neetix.liveliness

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Neetix Liveliness API client for Android.
 *
 * Capture image bytes with CameraX (ImageCapture) and pass the JPEG [ByteArray]
 * to these suspend functions. All calls run on Dispatchers.IO.
 */
class NeetixClient(
    baseUrl: String,
    private val apiKey: String? = null,
    private val http: OkHttpClient = OkHttpClient(),
) {
    private val base = baseUrl.trimEnd('/')
    private val json = Json { ignoreUnknownKeys = true }

    /** Passive liveliness on a single selfie. */
    suspend fun liveness(selfie: ByteArray): LivenessResponse =
        post("/v1/liveness", mapOf("person" to selfie))

    /** Face match + liveliness. */
    suspend fun faceMatch(
        selfie: ByteArray,
        card: ByteArray,
        fields: Map<String, String> = emptyMap(),
    ): FaceMatchResponse =
        post("/v1/face/face-match", mapOf("person" to selfie, "card" to card), fields)

    /** Enroll a user's face for biometric authentication. */
    suspend fun authEnroll(userId: String, selfie: ByteArray): EnrollResponse =
        post("/v1/auth/enroll", mapOf("person" to selfie), mapOf("user_id" to userId))

    /** Authenticate a returning user by face + liveliness. */
    suspend fun authVerify(userId: String, selfie: ByteArray): AuthVerifyResponse =
        post("/v1/auth/verify", mapOf("person" to selfie), mapOf("user_id" to userId))

    /** Parse + validate a passport/ID MRZ. */
    suspend fun parseMrz(mrz: String): MrzResponse = withContext(Dispatchers.IO) {
        val body = json.encodeToString(MrzRequest.serializer(), MrzRequest(mrz))
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder().url("$base/v1/document/mrz")
            .apply { apiKey?.let { header("Authorization", "Bearer $it") } }
            .post(body).build()
        decode(req)
    }

    private suspend inline fun <reified T> post(
        path: String,
        images: Map<String, ByteArray>,
        fields: Map<String, String> = emptyMap(),
    ): T = withContext(Dispatchers.IO) {
        val builder = MultipartBody.Builder().setType(MultipartBody.FORM)
        fields.forEach { (k, v) -> builder.addFormDataPart(k, v) }
        images.forEach { (name, bytes) ->
            builder.addFormDataPart(
                name, "image.jpg",
                bytes.toRequestBody("image/jpeg".toMediaType()),
            )
        }
        val req = Request.Builder().url("$base$path")
            .apply { apiKey?.let { header("Authorization", "Bearer $it") } }
            .post(builder.build()).build()
        decode(req)
    }

    private inline fun <reified T> decode(req: Request): T {
        http.newCall(req).execute().use { res ->
            val text = res.body?.string().orEmpty()
            if (!res.isSuccessful) throw NeetixApiException(res.code, text)
            return json.decodeFromString(text)
        }
    }
}

class NeetixApiException(val statusCode: Int, message: String) : Exception(message)

@Serializable
private data class MrzRequest(val mrz: String)

@Serializable
data class LivenessResponse(
    val status: String,
    @SerialName("liveness_score") val livenessScore: Double,
    @SerialName("liveness_status") val livenessStatus: String,
    @SerialName("face_count") val faceCount: Int,
) {
    val approved: Boolean get() = status == "Approved"
}

@Serializable
data class AuthVerifyResponse(
    val authenticated: Boolean,
    @SerialName("user_id") val userId: String,
    @SerialName("match_confidence") val matchConfidence: Double,
    @SerialName("liveness_score") val livenessScore: Double,
    @SerialName("liveness_ok") val livenessOk: Boolean,
)

@Serializable
data class EnrollResponse(
    val status: String,
    @SerialName("enrollment_id") val enrollmentId: String,
    @SerialName("user_id") val userId: String,
)

@Serializable
data class Warning(val code: String, val severity: String, val description: String)

@Serializable
data class FaceMatchResponse(
    val status: String,
    val verdict: String,
    val warnings: List<Warning> = emptyList(),
) {
    val approved: Boolean get() = verdict == "approved"
}

@Serializable
data class MrzChecks(
    @SerialName("document_number") val documentNumber: Boolean,
    @SerialName("date_of_birth") val dateOfBirth: Boolean,
    @SerialName("expiry_date") val expiryDate: Boolean,
    val composite: Boolean,
)

@Serializable
data class MrzResponse(
    val valid: Boolean,
    val format: String,
    @SerialName("document_number") val documentNumber: String,
    val surname: String,
    @SerialName("given_names") val givenNames: String,
    val nationality: String,
    @SerialName("date_of_birth") val dateOfBirth: String,
    @SerialName("expiry_date") val expiryDate: String,
    val checks: MrzChecks,
)
