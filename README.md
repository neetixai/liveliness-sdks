# Neetix Liveliness SDKs

Official client SDKs for the **[Neetix Liveliness API](https://liveliness.neetix.in)** —
a Rust-powered Selfie-KYC suite: face match + passive/active/streaming
liveliness (PAD), selfie age checks, AML/sanctions screening, passport MRZ
parsing, KYB validation, and biometric re-authentication. One API, five
clients, the same method names everywhere:

`signup · faceMatch · liveness · ageCheck · amlScreen · mrzParse · balance · ledger`
(plus sessions, V-CIP streaming, KYB, biometric auth, and billing top-ups).

Pricing is prepaid credits: **500 free on signup**, then face-match 2,
streaming 5, KYB 2, workflow 3, everything else 1 credit per call. An
exhausted balance returns HTTP 402 `insufficient_credits`; every SDK
surfaces that as a typed error with `status` + `messageCode`.

## 60-second quickstart

1. Get an API key (shown once — save it):

```bash
curl -X POST https://liveliness.neetix.in/v1/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@company.com"}'
# → { "api_key": "…", "credits": 500, … }
```

2. Verify a face (TypeScript, Node >= 18):

```ts
import { NeetixClient } from "@neetix/liveliness";
import { readFile } from "node:fs/promises";

const nx = new NeetixClient({ apiKey: process.env.NEETIX_API_KEY });
const jpeg = async (p) => new Blob([await readFile(p)], { type: "image/jpeg" });

const res = await nx.faceMatch(await jpeg("selfie.jpg"), await jpeg("id.jpg"));
console.log(res.verdict);                 // "approved" | "review" | "declined"
console.log(res.result.is_same_face, res.result.liveness_score);
console.log(res.warnings);                // risk-policy codes, e.g. EDITED_IMAGE
```

Runnable end-to-end version (signup → age check → face match → balance):
[`examples/node-quickstart.mjs`](examples/node-quickstart.mjs).

## Support matrix

| Platform | Package | Status | Install |
|---|---|---|---|
| Web / Node (TypeScript) | [`@neetix/liveliness`](web/) | **beta** | `npm i "https://gitpkg.vercel.app/neetixai/liveliness-sdks/web?main"` (npm-publish-ready) — see [web/README.md](web/README.md) |
| Flutter / Dart | [`neetix_liveliness`](flutter/) | **beta** | git dependency, `path: flutter` — see [flutter/README.md](flutter/README.md) |
| iOS / macOS (Swift) | [`NeetixLiveliness`](swift/) | **beta** | SPM: `.package(url: "https://github.com/neetixai/liveliness-sdks", branch: "main")` |
| React Native | [`@neetix/liveliness-react-native`](react-native/) | **pre-release** | clone + `npm i ./liveliness-sdks/react-native` — see [react-native/README.md](react-native/README.md) |
| Android (Kotlin) | [`in.neetix.liveliness`](android/) | **pre-release** (written, not compiled in CI) | source drop-in / Gradle included module — see [android/README.md](android/README.md) |

Status honesty: *beta* SDKs are typechecked/compiled + unit-tested in CI and
the TS core has been exercised against the live API; *pre-release* SDKs share
the same verified surface but haven't been shipped in an app (React Native)
or compiled at all in this repo's CI (Android — no JDK toolchain here; see
[.github/workflows/ci.yml](.github/workflows/ci.yml)).

## What's covered

Every SDK: `signup`, `faceMatch`, `liveness`, `ageCheck`*, `amlScreen`,
`mrzParse`, `balance`, `ledger`, plus `sessionStart`/`sessionVerify` (active
challenges), `authEnroll`/`authVerify` (biometric login), and billing
`packs`/`topup`. The web SDK additionally wraps the V-CIP WebSocket stream
(`streamStart` + `StreamSession`) and browser camera capture (`openCamera`);
KYB validation (`kybValidate`) is on web, Flutter, Swift, and Android.

\* `POST /v1/age` is a new endpoint rolling out now — every SDK's `ageCheck`
targets it, and the examples show how to degrade gracefully on deployments
that still 404 it.

Errors are uniform: each SDK throws/raises one error type carrying the HTTP
`status` and the API's stable `messageCode` (`unauthorized`,
`no_face_detected`, `insufficient_credits`, …), with an
`isInsufficientCredits` convenience flag for quota handling.

## Docs & help

- API reference & console: **https://liveliness.neetix.in**
- Integration cheat-sheet (all endpoints, exact shapes): the
  `INTEGRATION.md` served with the API docs
- Per-SDK READMEs: [web](web/README.md) · [flutter](flutter/README.md) ·
  [swift](swift/README.md) · [react-native](react-native/README.md) ·
  [android](android/README.md)
- Examples: [examples/](examples/)

## License

[Apache-2.0](LICENSE) — © 2026 Neetix.
