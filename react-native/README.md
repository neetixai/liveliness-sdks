# @neetix/liveliness-react-native

React Native wrapper for the [Neetix Liveliness API](https://liveliness.neetix.in).

Status: **pre-release** — the transport client is the well-tested
`@neetix/liveliness` core; the RN layer (hook + file helpers) has not yet
been exercised in a shipped app.

## Shared surface

This package is a thin layer over `@neetix/liveliness` (the web/Node SDK) and
re-exports it wholesale. The core client is framework-agnostic: it accepts
`{ uri }` file parts (RN's FormData convention) and uses RN's global `fetch`.
So `client.signup / faceMatch / liveness / ageCheck / amlScreen / mrzParse /
documentId / balance / ledger / sessionStart / streamStart / kybValidate /
packs / topup` are all available — see the [web SDK README](../web/README.md) for the full
method table; only the capture layer is RN-specific.

Camera capture is BYO: use `react-native-vision-camera` or `expo-camera`,
then pass the captured file `uri`.

## Install

The dependency on `@neetix/liveliness` is a `file:../web` link, so until the
npm publish lands, install from a full clone (the reliable path — the web
core must sit next to this package):

```bash
git clone https://github.com/neetixai/liveliness-sdks
npm i ./liveliness-sdks/react-native
```

(npm cannot install a git subdirectory, and packing this folder alone would
break the `file:../web` link. Once published to npm this becomes a normal
semver dependency.)

## Quickstart

```tsx
import { useLiveliness } from "@neetix/liveliness-react-native";

function KycScreen() {
  const nx = useLiveliness({ apiKey: NEETIX_API_KEY });

  const onCapture = async (photoUri: string, idUri: string) => {
    const res = await nx.faceMatch(photoUri, idUri, { clientRefId: "order-42" });
    console.log(res.verdict, res.warnings);
  };

  return <Camera onPhoto={onCapture} busy={nx.loading} />;
}
```

## Hook surface

| Member | Description |
|---|---|
| `client` | The full `NeetixClient` — every API method |
| `loading` / `error` | State for the wrapped calls |
| `liveness(selfieUri)` | Passive liveliness (1 credit) |
| `ageCheck(selfieUri)` | Selfie age estimation (1 credit; new endpoint) |
| `faceMatch(selfieUri, cardUri, opts?)` | 1:1 match + liveliness (2 credits) |
| `authVerify(userId, selfieUri)` | Biometric re-authentication (1 credit) |
| `documentId({backUri?, frontUri?})` | US/CA DL/state-ID barcode parse + front forensics (2 credits; at least one image) |

Errors are `NeetixApiError` with `status` + `messageCode`
(`insufficient_credits` on HTTP 402 = top up at `/v1/billing/topup`).
