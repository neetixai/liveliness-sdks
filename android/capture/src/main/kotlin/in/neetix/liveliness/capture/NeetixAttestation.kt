package `in`.neetix.liveliness.capture

import android.content.Context
import android.util.Base64
import com.google.android.play.core.integrity.IntegrityManager
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import java.security.MessageDigest
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Play Integrity hook for the Neetix Liveliness attestation contract.
 *
 * Requests a standard Play Integrity token (classic request) whose nonce is
 * bound to the API request's `capture_nonce`:
 *
 *     nonce = base64url_nopad( SHA-256( capture_nonce ) )
 *
 * Send the resulting token alongside the capture as optional multipart
 * fields on `/v1/face/face-match`, `/v1/liveness`, `/v1/age`:
 *
 *   - `attest_platform` = `"android"`
 *   - `attest_token`    = the token returned here
 *   - plus the existing `capture_nonce` field (the same value passed in)
 *
 * Omitting them keeps current behavior. With the client module included, the
 * typed path is `Attestation.android(token)` on `NeetixClient.faceMatch` /
 * `liveness` / `ageCheck`. The response then carries an
 * `attestation: {platform, verified, detail}` object; `verified == false`
 * adds an `ATTESTATION_FAILED` warning (decline when the server has
 * `[attestation].require` set).
 *
 * Usage:
 * ```kotlin
 * val attestation = NeetixAttestation(context)
 * val token = attestation.requestToken(captureView.captureNonce)
 * val res = client.faceMatch(
 *     person = jpeg, card = idJpeg,
 *     captureNonce = captureView.captureNonce,
 *     attestation = Attestation.android(token),
 * )
 * ```
 *
 * @param cloudProjectNumber Google Cloud project number — required by Play
 *   Integrity when the app is distributed outside Google Play or for SDKs;
 *   optional for Play-distributed apps.
 */
class NeetixAttestation(
    context: Context,
    private val cloudProjectNumber: Long? = null,
) {
    private val manager: IntegrityManager =
        IntegrityManagerFactory.create(context.applicationContext)

    /**
     * Request a Play Integrity token bound to [captureNonce]. Suspends until
     * Play services responds; throws the Play Integrity exception on failure
     * (e.g. `IntegrityServiceException` API_NOT_AVAILABLE on devices without
     * Play services — treat attestation as unavailable and send nothing).
     */
    suspend fun requestToken(captureNonce: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(captureNonce.toByteArray(Charsets.UTF_8))
        val nonce = Base64.encodeToString(
            digest,
            Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING,
        )
        val request = IntegrityTokenRequest.builder()
            .setNonce(nonce)
            .apply { cloudProjectNumber?.let { setCloudProjectNumber(it) } }
            .build()
        return suspendCancellableCoroutine { cont ->
            manager.requestIntegrityToken(request)
                .addOnSuccessListener { response -> cont.resume(response.token()) }
                .addOnFailureListener { e -> cont.resumeWithException(e) }
        }
    }

    /**
     * Convenience: the exact multipart fields to attach to a request —
     * `capture_nonce`, `attest_platform`, `attest_token` (e.g. for
     * `NeetixClient.faceMatch(extraFields = ...)` or your own HTTP stack).
     */
    suspend fun attestationFields(captureNonce: String): Map<String, String> = mapOf(
        "capture_nonce" to captureNonce,
        "attest_platform" to "android",
        "attest_token" to requestToken(captureNonce),
    )
}
