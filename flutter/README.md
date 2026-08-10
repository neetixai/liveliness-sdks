# neetix_liveliness — Dart / Flutter SDK

Pure-Dart client (built on `package:http`) for the
[Neetix Liveliness API](https://liveliness.neetix.in). Works on Flutter
mobile, web, desktop, and server-side Dart — capture is BYO (`camera` /
`image_picker`); pass JPEG bytes.

Status: **beta**.

## Install (git dependency)

```yaml
# pubspec.yaml
dependencies:
  neetix_liveliness:
    git:
      url: https://github.com/neetixai/liveliness-sdks.git
      path: flutter
      ref: main
```

## Quickstart (10 lines)

```dart
import 'package:neetix_liveliness/neetix_liveliness.dart';

final nx = NeetixClient(apiKey: 'YOUR_KEY');
// No key yet? final s = await NeetixClient().signup('you@co.com'); // 500 free credits

final selfie = await File('selfie.jpg').readAsBytes();
final card = await File('id.jpg').readAsBytes();

final res = await nx.faceMatch(selfie, card, clientRefId: 'order-42');
print('${res.verdict} same_face=${res.isSameFace} warnings=${res.warnings.length}');
```

## Methods

| Method | Endpoint | Credits | Returns |
|---|---|---|---|
| `signup(email)` | `POST /v1/signup` | free (grants 500) | `SignupResponse` — `apiKey` shown once |
| `faceMatch(person, card, …)` | `POST /v1/face/face-match` | 2 | `FaceMatchResponse` (`verdict`, `warnings`, full `result` map) |
| `liveness(person)` | `POST /v1/liveness` | 1 | `LivenessResponse` |
| `ageCheck(person)` | `POST /v1/age` | 1 | `AgeCheckResponse` (new endpoint; 404 on older deployments) |
| `sessionStart()` | `POST /v1/session/start` | 1 | `SessionStartResponse` |
| `sessionVerify(id, frames)` | `POST /v1/session/{id}/verify` | 1 | raw verdict map |
| `authEnroll(userId, person)` | `POST /v1/auth/enroll` | 1 | raw map |
| `authVerify(userId, person)` | `POST /v1/auth/verify` | 1 | `AuthVerifyResponse` |
| `amlScreen(name, dob:, threshold:)` | `POST /v1/aml/screen` | 1 | `AmlScreenResponse` |
| `kybValidate(gstin:, pan:, cin:)` | `POST /v1/kyb/validate` | 2 | `KybValidateResponse` |
| `mrzParse(mrz)` | `POST /v1/document/mrz` | 1 | `MrzResponse` |
| `balance()` | `GET /v1/billing/balance` | — | `BalanceResponse` |
| `ledger(limit:)` | `GET /v1/billing/ledger` | — | `LedgerResponse` |
| `packs()` / `topup(pack, email:)` | `GET/POST /v1/billing/…` | — | raw maps (`topup` returns `checkout_url`) |

Streaming (WebSocket `/v1/stream/{id}`) is not wrapped in Dart yet; use
`sessionStart` + `sessionVerify` for active challenges, or the web SDK for
V-CIP streams.

## Errors

Non-2xx responses throw `NeetixApiException` with `statusCode`, `message`,
and `messageCode` (e.g. `unauthorized`, `no_face_detected`,
`insufficient_credits`). `e.isInsufficientCredits` flags an exhausted
prepaid balance (HTTP 402) — send the user through
`topup(...)` → `checkout_url`.
