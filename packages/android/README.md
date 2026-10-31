# Neetix Liveliness — Android SDK (Kotlin)

Kotlin client (OkHttp + kotlinx-serialization, coroutines) for the
[Neetix Liveliness API](https://liveliness.neetix.in), plus an **optional
CAPTURE module** (`capture/`) with a guided CameraX capture view and a Play
Integrity attestation hook.

Status, honestly:

- **Client (`src/main/kotlin`) — beta, JVM-verified.** Pure JVM code (no
  Android imports); `jvm-check/` compiles it as Kotlin/JVM in CI
  (`gradle compileKotlin`, JDK 21 — see `.github/workflows/ci.yml`), and it
  has been runtime-verified against production. Android-instrumented tests
  are still pending.
- **Capture module (`capture/`) — written, NOT compiled in this repo.** It is
  real Android code (CameraX, Play Integrity) and requires the Android SDK +
  AGP to build; this repo's CI has no Android toolchain, so it ships
  write-only. It is deliberately excluded from `jvm-check` so the client's
  JVM verification stays green. Build it inside your app project and report
  issues.

## Install (JitPack)

Published and consumer-verified as of **0.2.0**:

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}

// build.gradle.kts
implementation("com.github.neetixai:liveliness-sdks:0.2.0")
```

The artifact id is the repo name, not `liveliness-android` — JitPack
republished the single artifact under the repo-level coordinates. The
`in.neetix` group only applies to a future Maven Central release
(PUBLISHING.md §4).

okhttp, kotlinx-serialization and kotlinx-coroutines come in transitively; the
serialization **compiler plugin** does not, so your app module still needs
`id("org.jetbrains.kotlin.plugin.serialization")` if it touches the
`@Serializable` models directly.

The optional CameraX + Play Integrity capture code
(`capture/src/main/kotlin/`) is **not** in the published artifact — it is
pre-release and uncompiled here. Take it as source or an included module.

### Alternative: source drop-in / included module

1. Copy `src/main/kotlin/in/neetix/liveliness/` into your app module and add
   the three dependencies from `build.gradle.kts` (plus, optionally,
   `capture/src/main/kotlin/` with the CameraX/Integrity deps from
   `capture/build.gradle.kts`), or
2. Add the directories as included Gradle modules:

```kotlin
// settings.gradle.kts (your app)
include(":neetix-liveliness")
project(":neetix-liveliness").projectDir = file("path/to/liveliness-sdks/packages/android")
// optional camera capture + attestation module:
include(":neetix-liveliness-capture")
project(":neetix-liveliness-capture").projectDir = file("path/to/liveliness-sdks/packages/android/capture")
```

Make sure your project applies the kotlinx-serialization plugin classpath
(`org.jetbrains.kotlin.plugin.serialization`).

## Quickstart (10 lines)

```kotlin
import `in`.neetix.liveliness.NeetixClient

val nx = NeetixClient(apiKey = BuildConfig.NEETIX_API_KEY)
// No key yet? val s = NeetixClient().signup("you@co.com") // 1,000 free credits

// jpegSelfie / jpegCard: ByteArray from CameraX ImageCapture
val res = nx.faceMatch(jpegSelfie, jpegCard, clientRefId = "order-42")
if (res.approved) proceed() else review(res.verdict, res.warnings)
```

## Methods

| Method | Endpoint | Credits | Returns |
|---|---|---|---|
| `signup(email)` | `POST /v1/signup` | free (grants 1,000) | `SignupResponse` — `apiKey` shown once |
| `faceMatch(person, card, …)` | `POST /v1/face/face-match` | 2 | `FaceMatchResponse` (`verdict`, `warnings`, typed `result`) |
| `liveness(person)` | `POST /v1/liveness` | 1 | `LivenessResponse` |
| `ageCheck(person)` | `POST /v1/age` | 1 | `AgeCheckResponse` (new endpoint; 404 on older deployments) |
| `sessionStart()` | `POST /v1/session/start` | 1 | `SessionStartResponse` |
| `sessionVerify(id, frames)` | `POST /v1/session/{id}/verify` | 1 | raw `JsonObject` |
| `authEnroll(userId, person)` | `POST /v1/auth/enroll` | 1 | `EnrollResponse` |
| `authVerify(userId, person)` | `POST /v1/auth/verify` | 1 | `AuthVerifyResponse` |
| `amlScreen(name, dob, threshold)` | `POST /v1/aml/screen` | 1 | `AmlScreenResponse` |
| `kybValidate(gstin, pan, cin)` | `POST /v1/kyb/validate` | 2 | raw `JsonObject` |
| `mrzParse(mrz)` | `POST /v1/document/mrz` | 1 | `MrzResponse` |
| `documentId(back, front)` | `POST /v1/document/id` | 2 | `DocumentIdResponse` — PDF417→AAMVA parse (`aamva`, `checks`), front-side `faceFound` + `forensics`; at least one image required |
| `balance()` | `GET /v1/billing/balance` | — | `BalanceResponse` |
| `ledger(limit)` | `GET /v1/billing/ledger` | — | `LedgerResponse` |
| `packs()` / `topup(pack, email)` | `GET/POST /v1/billing/…` | — | `PacksResponse` / `TopupResponse` (open `checkoutUrl`) |

Streaming V-CIP (`WS /v1/stream/{id}`) is not wrapped yet — use OkHttp's
`WebSocket` against the stream URL, sending JPEG frames as binary messages.

## Capture module (`capture/`, Android-only, optional)

`NeetixCaptureView` (package `in.neetix.liveliness.capture`) is a plain
Android `View` — usable from Compose via `AndroidView { ... }` — that gives
you a production-grade guided capture flow:

- CameraX preview with an **oval guide** (selfie, front camera) or **ID-1
  card guide** (document, back camera) — `Mode.SELFIE` / `Mode.DOCUMENT`
- luma-based **brightness hints** (`TOO_DARK` / `TOO_BRIGHT`) and frame-diff
  **stability hints** (`HOLD_STILL` / `STABLE`) from a 16×16 Y-plane grid
- **auto-capture** after 1.5 s of continuous stability, with an on-overlay
  countdown (default 3 s; cancelled if the scene moves) — plus a manual
  `capture()` fallback
- output JPEG rotated upright and downscaled to **<= 1280 px, quality 80**
- a fresh `captureNonce` per `start()`/`rearm()` for the API's
  `capture_nonce` field and attestation binding

```kotlin
val cam = NeetixCaptureView(context).apply {
    mode = NeetixCaptureView.Mode.SELFIE
    listener = object : NeetixCaptureView.Listener {
        override fun onHint(hint: NeetixCaptureView.Hint) { /* show copy */ }
        override fun onCaptured(jpeg: ByteArray) {
            scope.launch {
                val res = nx.liveness(jpeg, captureNonce = captureNonce)
            }
        }
    }
}
container.addView(cam)
cam.start(lifecycleOwner) // caller must hold android.permission.CAMERA
```

The host app is responsible for requesting the `CAMERA` runtime permission
before `start()`.

## Device attestation (optional)

`/v1/face/face-match`, `/v1/liveness` and `/v1/age` accept optional
multipart fields `attest_platform` (`"android"`/`"ios"`), `attest_token`
(base64) and `attest_key_id` (iOS only), bound to the request's
`capture_nonce`. Omitting them keeps current behavior. When sent, the
response gains `attestation: {platform, verified, detail}` (typed as
`AttestationInfo`); `verified == false` adds an `ATTESTATION_FAILED` warning
(severity `review`; `decline` when the server has `[attestation].require`).

On Android the capture module's `NeetixAttestation` wraps the standard Play
Integrity API (classic request, nonce = `base64url(SHA-256(capture_nonce))`):

```kotlin
val attestor = NeetixAttestation(context) // cloudProjectNumber for non-Play distribution
val token = attestor.requestToken(cam.captureNonce)
val res = nx.faceMatch(
    selfieJpeg, cardJpeg,
    captureNonce = cam.captureNonce,
    attestation = Attestation.android(token),
)
res.attestation?.let { if (!it.verified) review(it.detail) }
```

No Play services (or Integrity error)? Just send nothing — attestation
params are optional, and the server only hard-requires them when configured
with `[attestation].require`.

### New in 0.2.0

| Method | Endpoint | Credits |
|---|---|---|
| `faceEnroll(subjectId, person, blocklisted)` / `faceSearch(person, topK:)` | `/v1/face/enroll`, `/v1/face/search` | 1 each |
| `templateProtect(person, keyVersion:)` / `templateVerify(a, b)` | `/v1/template/*` | 1 each |
| `validateIdentity(...)` / `validateContact(...)` | `/v1/validate/*` | 1 each |
| `deviceAnalyze(signals)` | `/v1/device/analyze` | 1 |
| `workflowRun(checks: …)` | `/v1/workflow/run` | 3 |
| `streamStart()` | `/v1/stream/start` | 5 |
| `linkInfo(token)` / `linkVerify(token, person, card)` | `/v1/links/{token}` | public; charges the link owner |
| `verificationKey()` | `/v1/verification-key` | public |

This SDK covers the full **on-device** scope (28 endpoints). Back-office
endpoints — review queue, tenant settings, link minting, saved workflows, AML
monitoring, KYT, DSAR — are intentionally absent: a key inside an app can be
extracted, so those live only in the server SDK. See the root
[README](../../README.md#coverage).

## Errors

Non-2xx responses throw `NeetixApiException` with `statusCode`, `message`,
`messageCode` (e.g. `unauthorized`, `no_face_detected`,
`insufficient_credits`) and the raw JSON `body`.
`e.isInsufficientCredits` flags an exhausted prepaid balance (HTTP 402).
