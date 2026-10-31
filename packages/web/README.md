# @neetix/liveliness — Web / Node TypeScript SDK

Zero-dependency, fetch-based client for the [Neetix Liveliness API](https://liveliness.neetix.in).
Works in the browser, Node >= 18, and (via `{ uri }` file parts) React Native.

Status: **beta**.

## Install

```bash
npm i @neetix/liveliness
```

Until the npm publish lands ([PUBLISHING.md](../../PUBLISHING.md)), install it
from a clone:

```bash
git clone https://github.com/neetixai/liveliness-sdks
npm i ./liveliness-sdks/packages/web
```

`dist/` is not committed — the `prepare` script compiles it on install.

## Quickstart (10 lines)

```ts
import { NeetixClient } from "@neetix/liveliness";

const nx = new NeetixClient({ apiKey: process.env.NEETIX_API_KEY });
// No key yet? const { api_key } = await new NeetixClient().signup("you@co.com"); // 1,000 free credits

const selfie = new Blob([await fs.promises.readFile("selfie.jpg")], { type: "image/jpeg" });
const card = new Blob([await fs.promises.readFile("id.jpg")], { type: "image/jpeg" });

const res = await nx.faceMatch(selfie, card, { clientRefId: "order-42" });
console.log(res.verdict, res.result.is_same_face, res.warnings);
```

## Methods

| Method | Endpoint | Credits | Returns |
|---|---|---|---|
| `signup(email)` | `POST /v1/signup` | free (grants 1,000) | `SignupResponse` — live + test key, each shown once |
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
| `faceEnroll(subjectId, person, blocklisted?)` | `POST /v1/face/enroll` | 1 | `FaceEnrollResponse` — adds the face to your 1:N gallery |
| `faceSearch(person, topK?)` | `POST /v1/face/search` | 1 | `FaceSearchResponse` — ranked `matches[]`, `blocklist_hit` |
| `templateProtect(person, keyVersion?)` | `POST /v1/template/protect` | 1 | `TemplateProtectResponse` — revocable, non-invertible template (ISO/IEC 24745) |
| `templateVerify(a, b)` | `POST /v1/template/verify` | 1 | `TemplateVerifyResponse` — `revoked` across key versions |
| `amlMonitorAdd({name, dob?, refId?})` | `POST /v1/aml/monitor` | 1 | `AmlMonitorCreateResponse` — ongoing screening; clear→hit fires your webhook |
| `amlMonitorList(limit?)` / `amlMonitorDelete(id)` | `GET`/`DELETE /v1/aml/monitor` | — | monitored subjects |
| `validateIdentity({aadhaar, pan, voter, dl})` | `POST /v1/validate/identity` | 1 | `ValidateResponse` — Aadhaar returned MASKED only |
| `validateContact({email, phone})` | `POST /v1/validate/contact` | 1 | `ValidateResponse` — disposable-email flags, E.164 phone |
| `txnMonitor(transactions, thresholds?)` | `POST /v1/txn/monitor` | 1 | `TxnMonitorResponse` — structuring / velocity / round-tripping |
| `walletScreen(address, blocklist?)` | `POST /v1/wallet/screen` | 1 | `WalletScreenResponse` |
| `deviceAnalyze(signals)` | `POST /v1/device/analyze` | 1 | `DeviceAnalyzeResponse` — emulator/root/VPN risk score + flags |
| `workflowRun(input)` | `POST /v1/workflow/run` | 3 | `WorkflowRunResponse` — many checks, one folded verdict |
| `workflowsList()` / `workflowSave()` / `workflowUpdate()` / `workflowDelete()` | `/v1/workflows` | — | saved workflow configs |
| `linkCreate({label?, expiresHours?})` | `POST /v1/links` | free to mint (2 on completion) | `LinkCreateResponse` — hosted verify URL, no frontend needed |
| `linkList(limit?)` | `GET /v1/links` | — | `LinkListResponse` |
| `linkInfo(token)` / `linkVerify(token, person, card)` | `/v1/links/{token}` | charges the link owner | **public, unauthenticated** — the applicant side |
| `reviewsList(limit?)` | `GET /v1/reviews` | — | `ReviewsListResponse` — the `review` queue |
| `reviewDecide(requestId, decision, note?)` | `POST /v1/reviews/{id}/decision` | — | records the ruling + an audit row |
| `reviewImage(requestId, kind)` | `GET /v1/reviews/{id}/image/{kind}` | — | retained JPEG `Blob` (only with retention on) |
| `settingsGet()` / `settingsUpdate(update)` | `GET`/`PUT /v1/settings` | — | `TenantSettings` — webhook URL/secret, image retention |
| `accountExport()` / `accountDelete()` | `/v1/account/*` | — | DSAR export / irreversible deletion |
| `verificationKey()` | `GET /v1/verification-key` | — | **public** — Ed25519 key that signs face-match bodies |
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

## Guided capture (browser)

`startGuidedCapture` streams the front camera into a `<video>`, draws an oval
face guide on an overlay `<canvas>`, measures brightness / sharpness
(variance-of-Laplacian) / face-size each tick, and auto-captures a JPEG once
quality holds for ~1s:

```ts
import { startGuidedCapture } from "@neetix/liveliness";

const guide = await startGuidedCapture({
  video: document.querySelector("video")!,
  overlay: document.querySelector("canvas")!,
  onQuality: (q) => console.log(q.brightness, q.sharpness, q.faceSize, q.ok),
});
const { blob, readings } = await guide.result;   // JPEG + the quality trail
guide.stop();
const res = await nx.liveness(blob);
```

## Keys and scopes

`signup` returns a live key **and** a `lv_test_…` key. The test key is free and
unmetered with its own gallery and logs, and responses carry
`mode: "live" | "test"`.

This SDK wraps the whole API, including back-office surfaces (reviews,
settings, links, workflows, AML monitoring, DSAR). **Keep it server-side.** The
mobile SDKs deliberately omit those endpoints because a key shipped in an app
can be extracted — see the root [README](../../README.md#coverage).
