# NeetixLiveliness — Swift SDK (SPM)

URLSession async/await client for the
[Neetix Liveliness API](https://liveliness.neetix.in). Pure Foundation
networking — builds on iOS 14+, macOS 12+, and Linux. The capture UI
(`NeetixCaptureView`, SwiftUI + AVFoundation, iOS 15+) and the low-level
camera helper (`NeetixCamera`) are iOS-only and compile-gated; App Attest
(`NeetixAttestation`) degrades to `NeetixError.unsupported` off-device.

Status: **beta** — the library compiles via `swift build`; unit tests run
under Xcode/CI (XCTest is absent from bare Swift toolchains). The capture
UI is tested via its API surface only — run the example on a real device
before shipping (camera + App Attest don't exist on simulators/macOS).

## Install (Swift Package Manager)

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/neetixai/liveliness-sdks", branch: "main")
],
targets: [
    .target(name: "YourApp", dependencies: [
        .product(name: "NeetixLiveliness", package: "liveliness-sdks")
    ])
]
```

> The SPM package manifest lives in `swift/`; if your SPM version does not
> discover nested packages, add the repo in Xcode via
> File > Add Package Dependencies with the same URL.

## Quickstart (10 lines)

```swift
import NeetixLiveliness

let nx = NeetixClient(apiKey: "YOUR_KEY")
// No key yet? let s = try await NeetixClient().signup(email: "you@co.com") // 1,000 free credits

let selfie = try Data(contentsOf: selfieURL)
let card = try Data(contentsOf: idURL)

let res = try await nx.faceMatch(person: .jpeg(selfie), card: .jpeg(card), clientRefId: "order-42")
print(res.verdict, res.result.isSameFace, res.warnings.map(\.code))
```

## Guided capture (SwiftUI, iOS 15+)

`NeetixCaptureView` is a full-screen guided capture flow: AVFoundation
preview, an oval face guide (`.selfie`, front camera) or ID-1 card guide
(`.document`, back camera), live quality hints (brightness + motion
stability sampled from the video stream), auto-capture after 1.5 s of
stable good frames with a countdown ring, a manual shutter fallback, and a
retake/confirm step. Output is normalized JPEG (longest side ≤ 1280 px,
quality 0.8) — ready to upload as-is.

```swift
import SwiftUI
import NeetixLiveliness

struct SelfieKycScreen: View {
    let nx = NeetixClient(apiKey: "YOUR_KEY")

    var body: some View {
        NeetixCaptureView(mode: .selfie) { jpeg in       // .document for IDs
            Task {
                let res = try await nx.liveness(person: .jpeg(jpeg))
                print(res.status, res.livenessScore)
            }
        } onCancel: { /* dismiss */ }
    }
}
```

Add `NSCameraUsageDescription` to your Info.plist. Pass
`autoCapture: false` to disable the 1.5 s auto-shutter (the button still
works). UIKit apps that only want a preview layer can keep using the
low-level `NeetixCamera`:

```swift
let cam = try NeetixCamera()                  // iOS only
view.layer.addSublayer(cam.previewLayer)
let jpeg = try await cam.capture()
let live = try await nx.liveness(person: .jpeg(jpeg))
```

## App Attest (device attestation)

`NeetixAttestation` wraps `DCAppAttestService`. Attach its payload to
`faceMatch` / `liveness` / `ageCheck` and the server verifies it fully
offline (x5c chain to the Apple App Attest root CA + nonce check against
your `capture_nonce`), returning an `attestation` block on the response:

```swift
let jpeg: Data = ...                          // from NeetixCaptureView
let nonce = NeetixAttestation.makeNonce()     // the attestation challenge
let att = NeetixAttestation.isSupported
    ? try await NeetixAttestation.attest(captureNonce: nonce)  // fresh key + attest
    : nil                                     // simulator/macOS: send unattested

let res = try await nx.faceMatch(
    person: .jpeg(jpeg), card: .jpeg(card),
    captureNonce: nonce, attestation: att)

if let a = res.attestation, !a.verified {
    // server adds an ATTESTATION_FAILED warning (severity "review";
    // declines when the server runs with [attestation].require)
    print("attestation failed:", a.detail ?? "")
}
```

Wire contract (multipart fields, all optional — omitting them keeps
today's behavior): `attest_platform` = `"ios"`, `attest_token` = base64
CBOR attestation object, `attest_key_id` = App Attest key id,
`capture_nonce` = the challenge string (the leaf-cert nonce must equal
`SHA256(authData || SHA256(capture_nonce))`, which is what
`NeetixAttestation.attestKey` produces by passing `SHA256(nonce)` as the
`clientDataHash`). Responses gain
`attestation: {platform, verified, detail} | null`.

Requirements: real device (simulators throw `NeetixError.unsupported`),
the App Attest capability/entitlement
(`com.apple.developer.devicecheck.appattest-environment`), and an app
distributed with your team's provisioning. Attestation objects are
single-use per key, so `attest(captureNonce:)` generates a fresh key per
capture.

## Methods

| Method | Endpoint | Credits | Returns |
|---|---|---|---|
| `signup(email:)` | `POST /v1/signup` | free (grants 1,000) | `SignupResponse` — `apiKey` shown once |
| `faceMatch(person:card:…)` | `POST /v1/face/face-match` | 2 | `FaceMatchResponse` (`verdict`, `warnings`, typed `result`; optional `captureNonce`/`attestation` params) |
| `liveness(person:…)` | `POST /v1/liveness` | 1 | `LivenessResponse` (optional `captureNonce`/`attestation` params) |
| `ageCheck(person:…)` | `POST /v1/age` | 1 | `AgeCheckResponse` (new endpoint; 404 on older deployments; optional `captureNonce`/`attestation` params) |
| `sessionStart()` | `POST /v1/session/start` | 1 | `SessionStartResponse` |
| `sessionVerify(sessionId:frames:)` | `POST /v1/session/{id}/verify` | 1 | `SessionVerifyResponse` |
| `authEnroll(userId:person:)` | `POST /v1/auth/enroll` | 1 | `EnrollResponse` |
| `authVerify(userId:person:)` | `POST /v1/auth/verify` | 1 | `AuthVerifyResponse` |
| `amlScreen(name:dob:threshold:)` | `POST /v1/aml/screen` | 1 | `AmlScreenResponse` |
| `kybValidate(gstin:pan:cin:)` | `POST /v1/kyb/validate` | 2 | `KybValidateResponse` |
| `mrzParse(_:)` | `POST /v1/document/mrz` | 1 | `MrzResponse` |
| `documentId(back:front:)` | `POST /v1/document/id` | 2 | `DocumentIdResponse` — PDF417→AAMVA parse (`aamva`, `checks`), front-side `faceFound` + `forensics`; at least one image required |
| `balance()` | `GET /v1/billing/balance` | — | `BalanceResponse` |
| `ledger(limit:)` | `GET /v1/billing/ledger` | — | `LedgerResponse` |
| `packs()` / `topup(pack:email:)` | `GET/POST /v1/billing/…` | — | `PacksResponse` / `TopupResponse` (open `checkoutUrl`) |

Streaming V-CIP (`WS /v1/stream/{id}`) is not wrapped in Swift yet — use
`sessionStart`/`sessionVerify` for active challenges, or
`URLSessionWebSocketTask` against `streamUrl` manually.

### New in 0.2.0

| Method | Endpoint | Credits |
|---|---|---|
| `faceEnroll(subjectId:person:blocklisted:)` / `faceSearch(person, topK:)` | `/v1/face/enroll`, `/v1/face/search` | 1 each |
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

Non-2xx responses throw
`NeetixError.api(status:messageCode:message:body:)` — `messageCode` is the
stable machine code (`unauthorized`, `no_face_detected`,
`insufficient_credits`, …). `err.isInsufficientCredits` flags an exhausted
prepaid balance (HTTP 402): call `topup` and open `checkoutUrl`.
`NeetixError.unsupported` means the feature can't run on this target
(App Attest on the simulator/macOS/Linux) — proceed without attestation.
