# NeetixLiveliness — Swift SDK (SPM)

URLSession async/await client for the
[Neetix Liveliness API](https://liveliness.neetix.in). Pure Foundation
networking — builds on iOS 14+, macOS 12+, and Linux; the camera helper
(`NeetixCamera`, AVFoundation) is iOS-only and compile-gated.

Status: **beta** — the library compiles via `swift build`; unit tests run
under Xcode/CI (XCTest is absent from bare Swift toolchains).

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
// No key yet? let s = try await NeetixClient().signup(email: "you@co.com") // 500 free credits

let selfie = try Data(contentsOf: selfieURL)
let card = try Data(contentsOf: idURL)

let res = try await nx.faceMatch(person: .jpeg(selfie), card: .jpeg(card), clientRefId: "order-42")
print(res.verdict, res.result.isSameFace, res.warnings.map(\.code))
```

On-device capture:

```swift
let cam = try NeetixCamera()                  // iOS only
view.layer.addSublayer(cam.previewLayer)
let jpeg = try await cam.capture()
let live = try await nx.liveness(person: .jpeg(jpeg))
```

## Methods

| Method | Endpoint | Credits | Returns |
|---|---|---|---|
| `signup(email:)` | `POST /v1/signup` | free (grants 500) | `SignupResponse` — `apiKey` shown once |
| `faceMatch(person:card:…)` | `POST /v1/face/face-match` | 2 | `FaceMatchResponse` (`verdict`, `warnings`, typed `result`) |
| `liveness(person:)` | `POST /v1/liveness` | 1 | `LivenessResponse` |
| `ageCheck(person:)` | `POST /v1/age` | 1 | `AgeCheckResponse` (new endpoint; 404 on older deployments) |
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

## Errors

Non-2xx responses throw
`NeetixError.api(status:messageCode:message:body:)` — `messageCode` is the
stable machine code (`unauthorized`, `no_face_detected`,
`insufficient_credits`, …). `err.isInsufficientCredits` flags an exhausted
prepaid balance (HTTP 402): call `topup` and open `checkoutUrl`.
