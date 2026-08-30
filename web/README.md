# @neetix/liveliness-web

TypeScript client + browser camera capture for the Neetix Liveliness API:
face match, passive/active/continuous liveliness, biometric auth, MRZ parsing
and revocable templates. Framework-agnostic, zero runtime dependencies.

```bash
npm install @neetix/liveliness-web
```

## Quick start

```ts
import { NeetixClient, openCamera } from "@neetix/liveliness-web";

const client = new NeetixClient({ baseUrl: "https://api.neetix.in", apiKey });
const cam = await openCamera(document.querySelector("video")!);
const res = await client.liveness(await cam.capture());
```

## Guided capture (oval guide + auto-capture)

`startGuidedCapture` adds a selfie-capture UX on top of the raw camera: an
oval face-guide overlay, a live quality meter (brightness, sharpness,
face-size heuristic) and auto-capture once quality holds for ~1s.

```html
<div style="position: relative">
  <video style="width: 100%; transform: scaleX(-1)"></video>
  <canvas style="position: absolute; inset: 0; width: 100%; height: 100%"></canvas>
</div>
```

```ts
import { NeetixClient, startGuidedCapture } from "@neetix/liveliness-web";

const guide = await startGuidedCapture({
  video: document.querySelector("video")!,
  overlay: document.querySelector("canvas")!,
  onQuality: (q) => meter.textContent =
    `brightness ${q.brightness.toFixed(0)} · sharpness ${q.sharpness.toFixed(0)} · fill ${(q.faceSize * 100).toFixed(0)}%`,
});

const { blob, readings } = await guide.result; // auto-captured JPEG + readings
guide.stop();

const client = new NeetixClient({ baseUrl: "https://api.neetix.in", apiKey });
const res = await client.liveness(blob);
```

Thresholds, hold time, JPEG quality and camera constraints are configurable
via `GuidedCaptureOptions`; `guide.captureNow()` bypasses the meter.

## API surface

- `liveness(selfie)` — passive PAD
- `faceMatch(selfie, card, fields?)` — 1:1 match + liveliness + signals
- `authEnroll(userId, selfie)` / `authVerify(userId, selfie)` — biometric login
- `sessionStart()` / `sessionVerify(id, frames)` — active challenges
- `streamStart()` + `StreamSession` — continuous V-CIP over WebSocket
- `parseMrz(text)` — passport / ID MRZ
- `templateProtect` / `templateVerify` — revocable templates

See the [SDK overview](https://github.com/neetixai/liveliness-sdks) for the
other platforms (React Native, iOS, Android, Flutter).

## License

Apache-2.0
