# @neetix/edge-widget

**A drop-in, embeddable guided face-capture widget.** One script tag gives a host
site a webcam capture flow with an oval face-guide, a live positioning/quality
meter, passive-liveness gating and **auto-capture** — then hands back a good JPEG
frame plus metadata.

Face detection and passive liveness run **entirely on-device** via the
[`@neetix/edge`](https://liveliness.neetix.in/edge/) WASM engine (Rust → WebAssembly,
YuNet detector + MiniFASNet anti-spoof ensemble). **No pixels are uploaded.** The
host app receives the captured `Blob` and decides what to do with it.

> On-device / privacy pitch and a live proof: **https://liveliness.neetix.in/edge/**

---

## Embed it

```html
<div id="neetix-capture"></div>

<script src="https://cdn.example.com/neetix-edge-widget.js"></script>
<script>
  NeetixCapture.mount('#neetix-capture', {
    livenessRequired: true,
    wasmUrl: 'https://cdn.example.com/neetix_edge_bg.wasm',
    onCapture: (blob, meta) => {
      // Everything below is your call — nothing was uploaded by the widget.
      console.log('liveness', meta.livenessScore, 'faceBox', meta.faceBox);
      const fd = new FormData();
      fd.append('selfie', blob, 'selfie.jpg');
      fetch('/kyc/selfie', { method: 'POST', body: fd });
    },
    onError: (err) => console.warn(err.code, err.message),
  });
</script>
```

That is the whole integration: a container `<div>`, the bundle, and one `mount()`
call. No framework required. It also works as an ES module:

```ts
import { mount } from '@neetix/edge-widget';
const handle = mount('#neetix-capture', { onCapture });
```

---

## Behaviour

1. **Request camera** → live preview behind an oval face-guide (canvas overlay).
2. **Coach the user** with a real-time meter and short guidance:
   - *Move closer* / *Move back* — single-frame passive liveness needs head **and
     shoulders** in frame, so a face taller than ~46% of the frame prompts
     "move back" rather than emitting a false spoof.
   - *Center your face* / *Hold still* — centring + sharpness/brightness.
   - A passive-**liveness chip** (`Checking… → Live`).
3. **Auto-capture** once the face is well-positioned + live + sharp for ~1s
   (a progress arc fills around the oval). A **manual capture button** is always
   available as a fallback.
4. Returns a **JPEG `Blob`** + **metadata** to `onCapture`. The stored image is the
   true (un-mirrored) camera frame; `faceBox` is in that image's pixel space.

Robust states: `initializing → requesting-camera → positioning → capturing → done`,
plus clear handling for camera-denied / no-camera / unsupported browser via
`onError`.

---

## Options

| Option             | Type                                             | Default     | Description |
|--------------------|--------------------------------------------------|-------------|-------------|
| `onCapture`        | `(blob: Blob, meta: CaptureMeta) => void`        | —(required) | Receives the captured JPEG + metadata. |
| `onError`          | `(err: CaptureError) => void`                    | —           | Unrecoverable errors (see codes below). |
| `onState`          | `(state: WidgetState) => void`                   | —           | Lifecycle state changes. |
| `wasmUrl`          | `string`                                         | —           | URL of the engine `.wasm`; forwarded to `@neetix/edge`. |
| `livenessRequired` | `boolean`                                        | `true`      | Require passive liveness before auto-capture. |
| `autoCapture`      | `boolean`                                        | `true`      | Auto-capture when well-positioned; `false` = manual only. |
| `ovalSize`         | `number` (0.6–1.4)                               | `1`         | Scale the oval guide. |
| `holdMs`           | `number`                                         | `1000`      | How long the face must stay good before auto-capture. |
| `jpegQuality`      | `number` (0–1)                                   | `0.92`      | Captured JPEG quality. |
| `mirror`           | `boolean`                                        | `true`      | Mirror the preview (selfie feel); stored image is un-mirrored. |
| `facingMode`       | `"user" \| "environment"`                        | `"user"`    | Which camera to open. |
| `strings`          | `Partial<WidgetStrings>`                         | —           | i18n overrides for every on-screen string. |

### `CaptureMeta`

```ts
{
  livenessScore: number;      // 0..1
  live: boolean;
  genuine: boolean;
  faceBox: { x, y, w, h };    // in captured-image pixels
  quality: {
    brightness: number;       // mean luma inside the face box, 0..255
    sharpness: number;        // Laplacian variance (higher = sharper)
    faceFillHeight: number;   // face height / frame height (distance cue)
    centerOffset: number;     // 0 = perfectly centred
  };
  width: number; height: number;   // captured image size
  timestamp: number;               // epoch ms
}
```

### `CaptureError.code`

`no-element` · `unsupported` · `insecure-context` · `camera-denied` · `no-camera` · `engine`

### Handle

`mount()` returns `{ state, capture(), reset(), stop() }` — trigger a manual
capture, restart after a capture/error, or tear the widget down and release the
camera.

---

## On-device & privacy

- Detection + liveness are computed **in the browser via WASM**. The webcam stream,
  every analysed frame and the final capture stay on the device.
- The widget makes **no network calls** of its own — the only fetch is the engine
  `.wasm` you host. What you do with the returned `Blob` is entirely up to you.
- Verify it: open the Network tab, or pull Wi-Fi after load — capture keeps working.

---

## Build

```bash
npm install
npm run typecheck      # tsc --noEmit
npm run build          # → dist/neetix-edge-widget.js  (IIFE, global NeetixCapture)
npm run types          # → dist/*.d.ts
node build.mjs --dev   # readable, sourcemapped build
```

Bundler is [esbuild](https://esbuild.github.io/); the production bundle is a single
minified IIFE (~14 KB) with no runtime dependencies.

Open `demo/index.html` (over a local server) for a working smoke test that logs the
captured result and previews the frame.

---

## Wiring the real engine

This package is written against the `@neetix/edge` contract and ships with a
clearly-marked **stub** engine so it builds, typechecks and demos before the real
package is linked. To wire the real WASM engine, edit the single **integration
point** in [`src/edge.ts`](src/edge.ts):

```ts
export async function loadEdgeEngine(opts = {}) {
  const { NeetixEdge } = await import('@neetix/edge');
  return NeetixEdge.load({ wasmUrl: opts.wasmUrl });
}
```

Everything else — overlay, positioning logic, auto-capture, metadata — depends only
on the `NeetixEdge` interface and needs no changes.

## License

Apache-2.0
