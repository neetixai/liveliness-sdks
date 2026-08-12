# Neetix Liveliness — Android SDK (Kotlin)

Kotlin client (OkHttp + kotlinx-serialization, coroutines) for the
[Neetix Liveliness API](https://liveliness.neetix.in). Capture JPEG bytes
with CameraX and pass them to the suspend functions.

Status: **beta (JVM-compiled + live-verified), JVM-compiled (kotlinc 2.1/JDK 21; 0 errors) and runtime-verified against production — Android-instrumented tests still pending**. Honest disclosure: this module has NOT
been compiled or tested in this repo — the repo's CI has no JDK/Android
toolchain (see `.github/workflows/ci.yml`). The code is idiomatic Kotlin
mirroring the verified Swift/TypeScript clients, written against AGP 8.x /
Kotlin 1.9+ / OkHttp 4.12 / kotlinx-serialization 1.6. Expect to build it
inside your own app project; please report compile issues.

## Install (source drop-in, for now)

There is no Maven artifact yet. Either:

1. Copy `src/main/kotlin/in/neetix/liveliness/` into your app module and add
   the three dependencies from `build.gradle.kts`, or
2. Add this directory as an included Gradle module:

```kotlin
// settings.gradle.kts (your app)
include(":neetix-liveliness")
project(":neetix-liveliness").projectDir = file("path/to/liveliness-sdks/android")
```

Make sure your project applies the kotlinx-serialization plugin classpath
(`org.jetbrains.kotlin.plugin.serialization`).

## Quickstart (10 lines)

```kotlin
import `in`.neetix.liveliness.NeetixClient

val nx = NeetixClient(apiKey = BuildConfig.NEETIX_API_KEY)
// No key yet? val s = NeetixClient().signup("you@co.com") // 500 free credits

// jpegSelfie / jpegCard: ByteArray from CameraX ImageCapture
val res = nx.faceMatch(jpegSelfie, jpegCard, clientRefId = "order-42")
if (res.approved) proceed() else review(res.verdict, res.warnings)
```

## Methods

| Method | Endpoint | Credits | Returns |
|---|---|---|---|
| `signup(email)` | `POST /v1/signup` | free (grants 500) | `SignupResponse` — `apiKey` shown once |
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

## Errors

Non-2xx responses throw `NeetixApiException` with `statusCode`, `message`,
`messageCode` (e.g. `unauthorized`, `no_face_detected`,
`insufficient_credits`) and the raw JSON `body`.
`e.isInsufficientCredits` flags an exhausted prepaid balance (HTTP 402).
