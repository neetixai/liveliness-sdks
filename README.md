# Neetix Liveliness — Client SDKs

Official client SDKs for **[Neetix Liveliness](https://liveliness.neetix.in)** —
a pure-Rust identity-verification, face-liveness (presentation-attack detection)
and video-KYC (V-CIP) API, built India-first and self-hostable.

- **Website & product:** https://liveliness.neetix.in
- **Developer guide / quick start:** https://liveliness.neetix.in/developers
- **Full API reference (OpenAPI):** https://liveliness.neetix.in/api-reference
- **Open benchmark (LFW View-2, reproducible):** https://liveliness.neetix.in/benchmarks/

Publishing: see [PUBLISHING.md](./PUBLISHING.md) for per-registry commands,
required accounts/tokens and version-bump conventions.

One API, five clients. Each wraps the same endpoints (passive / active /
continuous liveliness, face match, biometric auth, MRZ, revocable templates)
with platform-native ergonomics + camera capture.

## Packages

| SDK | Path | Package | Verified in this repo |
|-----|------|---------|-----------------------|
| Web (TypeScript) | `sdk/web` | `@neetix/liveliness-web` | ✅ `tsc` typecheck + build (emits `dist/`) |
| React Native | `sdk/react-native` | `@neetix/liveliness-react-native` | ✅ `tsc --noEmit` typecheck |
| iOS (Swift) | `sdk/swift` | `NeetixLiveliness` (SPM) | ✅ `swift build` (library compiles) |
| Flutter (Dart) | `sdk/flutter` | `neetix_liveliness` | ✅ `dart analyze` + `dart test` (2/2) |
| Android (Kotlin) | `sdk/android` | `in.neetix.liveliness` | ⚠️ written, not compiled here (no JDK/Gradle in this env; builds under standard Android/Gradle) |

Honesty note: the Swift **library** compiles via `swift build`; its XCTest
unit tests require Xcode (absent in the bare Swift toolchain) and run in CI /
Xcode. The Android module is idiomatic and complete but was not compiled in
this environment, which has no JDK/Gradle.

## Shared design

Every SDK exposes the same surface:

- `liveness(selfie)` — passive PAD
- `faceMatch(selfie, card, fields?)` — 1:1 match + liveliness + signals
- `authEnroll(userId, selfie)` / `authVerify(userId, selfie)` — biometric login
- `parseMrz(text)` — passport / ID MRZ
- Web/RN also: `sessionStart` (active), `streamStart` + `StreamSession`
  (continuous V-CIP over WebSocket), `templateProtect` / `templateVerify`

Camera capture is platform-native (browser `getUserMedia`, AVFoundation on
iOS, CameraX on Android, `camera`/`image_picker` on Flutter); the API client
is transport-only so it stays testable without a device.

## Quick starts

**Web**
```ts
import { NeetixClient, openCamera } from "@neetix/liveliness-web";
const client = new NeetixClient({ baseUrl: "https://api.neetix.in", apiKey });
const cam = await openCamera(document.querySelector("video")!);
const res = await client.liveness(await cam.capture());
```

**Web — guided capture** (oval face-guide overlay + live quality meter +
auto-capture). `startGuidedCapture` streams the front camera into a `<video>`,
draws an oval guide on an overlay `<canvas>`, measures brightness, sharpness
(Laplacian) and a face-size heuristic each tick, and auto-captures a JPEG
once quality holds for ~1s:

```ts
import { NeetixClient, startGuidedCapture } from "@neetix/liveliness-web";

// <video> with an absolutely-positioned <canvas> overlaid on it
const guide = await startGuidedCapture({
  video: document.querySelector("video")!,
  overlay: document.querySelector("canvas")!,
  onQuality: (q) => console.log(q.brightness, q.sharpness, q.faceSize, q.ok),
});
const { blob, readings } = await guide.result; // JPEG + quality readings
guide.stop();
const res = await client.liveness(blob);
```

**React Native**
```ts
import { useLiveliness } from "@neetix/liveliness-react-native";
const nx = useLiveliness({ baseUrl, apiKey });
const res = await nx.liveness(photoUri); // photoUri from vision-camera / expo-camera
```

**iOS (Swift)**
```swift
let client = NeetixClient(baseURL: "https://api.neetix.in", apiKey: key)
let cam = try NeetixCamera()
let jpeg = try await cam.capture()
let res = try await client.liveness(selfie: .jpeg(jpeg))
```

**Flutter (Dart)**
```dart
final client = NeetixClient(baseUrl: 'https://api.neetix.in', apiKey: key);
final res = await client.liveness(jpegBytes); // from the `camera` plugin
```

**Android (Kotlin)**
```kotlin
val client = NeetixClient("https://api.neetix.in", apiKey)
val res = client.liveness(jpegBytes) // suspend; jpegBytes from CameraX
```

## About Neetix Liveliness

Neetix Liveliness is an identity-verification and face-liveness API written in
pure Rust: passive and active liveness / presentation-attack detection, 1:1 and
1:N face matching, continuous liveness for video-KYC (V-CIP), document/MRZ
reading, and revocable biometric templates. It runs as a single self-hostable
binary and is India-first.

We publish an **open, reproducible accuracy benchmark** (LFW View-2 protocol,
harness + machine-readable results) rather than an unverifiable marketing
number — see the [liveness-benchmark](https://github.com/neetixai/liveness-benchmark)
repo and https://liveliness.neetix.in/benchmarks/.

Honesty note: the benchmark uses LFW (celebrity, non-India-representative) and
Neetix holds no third-party certification (iBeta / ISO 30107-3 / NIST) yet —
those figures and caveats are documented in full in the benchmark repo.

- Get a free API key & sandbox: https://liveliness.neetix.in
- Developer docs: https://liveliness.neetix.in/developers
- API reference: https://liveliness.neetix.in/api-reference
