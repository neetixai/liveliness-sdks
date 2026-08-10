# @neetix/liveliness — Web / Node TypeScript SDK

Zero-dependency, fetch-based client for the [Neetix Liveliness API](https://liveliness.neetix.in).
Works in the browser, Node >= 18, and (via `{ uri }` file parts) React Native.

Status: **beta**.

## Install

From GitHub (until the npm publish lands):

```bash
# pnpm supports git-subdirectory installs directly:
pnpm add "github:neetixai/liveliness-sdks#main&path:/web"

# npm cannot install a git subdirectory — use gitpkg…
npm i "https://gitpkg.vercel.app/neetixai/liveliness-sdks/web?main"

# …or a plain clone:
git clone https://github.com/neetixai/liveliness-sdks
npm i ./liveliness-sdks/web
```

The package is publish-ready; once on npm it's just `npm i @neetix/liveliness`.
`dist/` is not committed — the `prepare` script compiles it on install.

## Quickstart (10 lines)

```ts
import { NeetixClient } from "@neetix/liveliness";

const nx = new NeetixClient({ apiKey: process.env.NEETIX_API_KEY });
// No key yet? const { api_key } = await new NeetixClient().signup("you@co.com"); // 500 free credits

const selfie = new Blob([await fs.promises.readFile("selfie.jpg")], { type: "image/jpeg" });
const card = new Blob([await fs.promises.readFile("id.jpg")], { type: "image/jpeg" });

const res = await nx.faceMatch(selfie, card, { clientRefId: "order-42" });
console.log(res.verdict, res.result.is_same_face, res.warnings);
```

## Methods

| Method | Endpoint | Credits | Returns |
|---|---|---|---|
| `signup(email)` | `POST /v1/signup` | free (grants 500) | `SignupResponse` — `api_key` shown once |
| `faceMatch(person, card, opts?)` | `POST /v1/face/face-match` | 2 | `FaceMatchResponse` — `verdict`, `warnings[]`, full `result` |
| `liveness(person)` | `POST /v1/liveness` | 1 | `LivenessResponse` |
| `ageCheck(person)` | `POST /v1/age` | 1 | `AgeCheckResponse` (new endpoint; 404 on older deployments) |
| `sessionStart()` | `POST /v1/session/start` | 1 | `SessionStartResponse` — challenge list |
| `sessionVerify(id, frames)` | `POST /v1/session/{id}/verify` | 1 | `SessionVerifyResponse` |
| `streamStart()` / `streamUrl(id)` | `POST /v1/stream/start`, `WS /v1/stream/{id}` | 5 | `StreamStartResponse`; drive the socket with `StreamSession` |
| `authEnroll(userId, person)` | `POST /v1/auth/enroll` | 1 | enrollment envelope |
| `authVerify(userId, person)` | `POST /v1/auth/verify` | 1 | `AuthVerifyResponse` |
| `amlScreen(name, dob?, threshold?)` | `POST /v1/aml/screen` | 1 | `AmlScreenResponse` — `hit`, `matches[]` |
| `kybValidate({gstin, pan, cin})` | `POST /v1/kyb/validate` | 2 | `KybValidateResponse` |
| `mrzParse(mrz)` | `POST /v1/document/mrz` | 1 | `MrzResponse` |
| `documentId({back?, front?})` | `POST /v1/document/id` | 2 | `DocumentIdResponse` — PDF417→AAMVA parse (`aamva`, `checks`), front-side `face_found` + `forensics`; at least one image required |
| `balance()` | `GET /v1/billing/balance` | — | `BalanceResponse` |
| `ledger(limit?)` | `GET /v1/billing/ledger` | — | `LedgerResponse` |
| `packs()` | `GET /v1/billing/packs` | — | `PacksResponse` |
| `topup(pack, email?)` | `POST /v1/billing/topup` | — | `TopupResponse` — open `checkout_url` |

## Errors

Every non-2xx response throws `NeetixApiError`:

```ts
try {
  await nx.liveness(selfie);
} catch (e) {
  if (e instanceof NeetixApiError) {
    e.status;               // 402
    e.messageCode;          // "insufficient_credits"
    e.isInsufficientCredits // true — time to top up
  }
}
```

## Streaming liveliness (V-CIP)

```ts
import { StreamSession, openCamera } from "@neetix/liveliness";

const { session_id } = await nx.streamStart();          // 5 credits
const stream = new StreamSession(nx.streamUrl(session_id), {
  onFrame: (f) => console.log("liveness", f.liveness, f.current_challenge),
  onVerdict: (v) => console.log("verdict", v.verdict, v.reasons),
});
await stream.ready();
const cam = await openCamera(videoElement);             // browser getUserMedia
setInterval(async () => stream.sendFrame(await cam.capture()), 300);
// … then stream.end() to request the final verdict.
```

`openCamera` is browser-only (getUserMedia); the client itself has no DOM
dependency and runs fine server-side.
