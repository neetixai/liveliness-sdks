# @neetix/edge

**Offline, on-device face detection + liveness — your face never leaves the browser.**

A tiny TypeScript wrapper over a Rust→WebAssembly face engine. Face detection
and passive liveness (anti-spoofing) run **entirely on the user's device**: your
JavaScript hands the wasm an RGBA frame and gets back boxes, 5 landmarks, and a
spoof verdict. After the one-time wasm download there are **zero network calls** —
open the Network tab, or pull the Wi-Fi, and it keeps working. No API key, no
server, no biometric ever transmitted.

Powered by the same models as the [Neetix Liveliness](https://liveliness.neetix.in)
engine — YuNet (detection) + a MiniFASNet 2-model ensemble (passive liveness) —
compiled to wasm with pure-Rust `tract-onnx` inference (no native onnxruntime).

```bash
npm install @neetix/edge
```

## Quick start

```ts
import { NeetixEdge } from "@neetix/edge";

const edge = await NeetixEdge.load();            // fetch + init the wasm (once)
const faces = edge.detect(videoEl);              // ImageData | Canvas | Video
if (faces[0]) {
  const live = edge.liveness(videoEl, faces[0]); // { live, score, genuine }
  console.log(faces[0].box, live.live, live.score);
}
```

`detect` / `liveness` accept an `ImageData`, an `HTMLCanvasElement`, or an
`HTMLVideoElement` (e.g. a live `getUserMedia` stream) — inputs are normalized to
`ImageData` internally via an offscreen canvas.

## What ships today vs. what's pending

| Capability | Method | Status |
|---|---|---|
| Face detection (box + 5 landmarks) | `detect` | ✅ **Ships now** |
| Passive liveness / anti-spoof | `liveness` | ✅ **Ships now** |
| 512-d face embedding | `embed` | ⏳ Needs the recognizer weights |
| 1:1 match (selfie ↔ ID) | `verify` | ⏳ Needs the recognizer weights |

`embed` and `verify` are fully implemented but require a `Recognizer` export in
the wasm. The detection + liveness models are Apache-2.0 and ship in the bundle
today. The **recognizer weights** are the hold-up, not the code: every SOTA
lightweight recognizer ships weights trained on research-only datasets
(MS-Celeb-1M / WebFace / Glint). Until a commercially-clean recognizer is
trained, `embed`/`verify` throw `EdgeUnsupportedError`, and any build that
includes a recognizer is **prototype-licensed** (evaluation only). Gate on
`edge.hasRecognizer` to branch cleanly:

```ts
if (edge.hasRecognizer) {
  const res = edge.verify(selfieVideo, idPhotoCanvas);
  console.log(res.match, res.similarity, res.selfieLiveness);
}
```

## API

```ts
interface EdgeFace {
  score: number;
  box: { x: number; y: number; w: number; h: number };
  landmarks: [number, number][]; // 5: right-eye, left-eye, nose, right-mouth, left-mouth
}
interface EdgeLiveness { live: boolean; score: number; genuine: boolean }

class NeetixEdge {
  static load(opts?: { wasmUrl?: string | URL; modelsUrl?: string | URL }): Promise<NeetixEdge>;
  detect(image: ImageData | HTMLCanvasElement | HTMLVideoElement): EdgeFace[];
  liveness(image: ImageData | HTMLCanvasElement | HTMLVideoElement, face: EdgeFace): EdgeLiveness;
  embed(image: ImageData | HTMLCanvasElement | HTMLVideoElement, face: EdgeFace): Float32Array; // 512-d, L2-normalized
  verify(selfie, idPhoto, opts?: { threshold?: number }): {
    match: boolean; similarity: number;
    selfieLiveness: EdgeLiveness; selfieFace: EdgeFace | null; idFace: EdgeFace | null;
  };
  static cosine(a: Float32Array, b: Float32Array): number;
  get hasRecognizer(): boolean;
  dispose(): void;
}
```

- **`load({ wasmUrl })`** — override where the `.wasm` is fetched from to
  self-host or serve from a CDN. Defaults to the copy bundled beside the glue.
  The engine uses streaming instantiation when possible and falls back to
  `arrayBuffer` automatically. **Serve the `.wasm` with `Content-Type:
  application/wasm`** — otherwise streaming is skipped (still works, just slower)
  and some strict setups may reject it.
- **`detect`** returns faces sorted by descending `score`. Coordinates are in the
  input image's pixel space (draw them straight onto a same-size canvas).
- **`liveness`** runs the MiniFASNet ensemble on the face box; `score` is the
  live probability, `live` is `score ≥ 0.5`, `genuine` is the ensemble's own
  argmax.
- **`verify`** is a convenience: detect the top face in each image, embed both,
  cosine-compare (default threshold `0.36`, override via `opts.threshold`), and
  run liveness on the selfie. Throws `EdgeUnsupportedError` without a recognizer.
- **`cosine`** — static helper if you manage embeddings yourself.
- **`dispose`** — free the wasm instances when you're done.

### Serving the wasm

`@neetix/edge` ships the glue (`wasm/neetix_edge.js`) and the binary
(`wasm/neetix_edge_bg.wasm`) inside the package, and loads the binary relative to
the glue by default — works out of the box with Vite / webpack 5 (they emit the
`.wasm` as an asset) and with native ESM / CDN imports. To self-host the binary,
copy it somewhere your server serves as `application/wasm` and pass its URL:

```ts
const edge = await NeetixEdge.load({ wasmUrl: "/static/neetix_edge_bg.wasm" });
```

## Bundle size (be honest with your users)

The wasm is **~13.2 MB raw / ~5.58 MB gzipped** — it embeds the tract runtime
plus every model (`include_bytes!`, nothing fetched at runtime). It is a
**one-time** download; cache it in a service worker / PWA and subsequent loads
are instant and fully offline. Rough gzip breakdown: tract runtime ~2.2 MB,
YuNet detector ~0.2 MB, MiniFASNet liveness ×2 ~3.2 MB.

## Performance

Desktop, WebAssembly **SIMD** (Chrome/Firefox/Safari 16.4+): detection
~145 ms/frame (~7 fps), liveness ~18 ms, one-time model load ~130 ms. Without
SIMD it's ~5× slower. On low-end Android expect a few hundred ms per detection —
fine for a **capture flow** (you need one good frame, not a 30 fps overlay), not
for a smooth real-time overlay. Numbers and methodology: the
[benchmark](https://liveliness.neetix.in/edge/) on the live demo.

## Try it

Live demo and benchmark: **https://liveliness.neetix.in/edge/**

A minimal webcam smoke test lives in [`example/index.html`](./example/index.html) —
serve the package root over HTTP and open it (camera needs `https://` or
`localhost`).

## License

Apache-2.0 (SDK code + the detection/liveness models). Any bundled recognizer is
prototype-licensed for evaluation until the production weights land — see
[What ships today](#what-ships-today-vs-whats-pending).

## wasm assets (not committed)

`wasm/*` is gitignored here (large binary; a recognizer build would embed
prototype non-commercial weights). The Rust that produces it — the `edge-poc`
crate — lives in the engine repo (`neetixai/liveliness-api`), not in this one,
so building the wasm needs both repos checked out side by side:

    # in the engine repo
    cd liveliness-api/edge-poc && wasm-pack build --target web --release \
      --out-dir pkg-web-neetix --out-name neetix_edge

    # back here (override the path if your checkouts aren't siblings)
    cd liveliness-sdks/packages/edge && npm run sync-wasm
    NEETIX_EDGE_PKG=/path/to/pkg-web-neetix npm run sync-wasm   # explicit path

Detection + liveness models are Apache-2.0. The recognizer (`embed`/`verify`)
requires a commercially-licensed or self-trained recognizer before publishing
— the default clean build ships without it (`hasRecognizer === false`).
