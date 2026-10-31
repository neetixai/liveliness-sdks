# Examples

All examples talk to the live API at `https://liveliness.neetix.in` and
self-signup for 1,000 free credits when `NEETIX_API_KEY` is not set.

## Node (`node-quickstart.mjs`)

```bash
npm install && npm run build -w @neetix/liveliness   # from the repo root
node examples/node-quickstart.mjs selfie.jpg id-card.jpg you@company.com
```

Pass `NEETIX_API_KEY=lv_test_…` to run it free against your test key.

Flow: signup → age check (skips gracefully if `/v1/age` isn't rolled out on
the deployment yet) → face match → remaining balance.

## Dart / Flutter (`flutter_example.dart`)

```bash
cd packages/flutter && dart pub get
dart run example/flutter_example.dart selfie.jpg id-card.jpg
```

(The same file lives at `packages/flutter/example/flutter_example.dart` so it
resolves the package without extra setup.)

The same file drops straight into a Flutter app that depends on
`neetix_liveliness` (swap `dart:io` file reads for camera bytes).

## Swift snippet

Add the package (see [`packages/swift/README.md`](../packages/swift/README.md)), then:

```swift
import NeetixLiveliness

let nx = NeetixClient(apiKey: ProcessInfo.processInfo.environment["NEETIX_API_KEY"] ?? "")
let selfie = try Data(contentsOf: URL(fileURLWithPath: "selfie.jpg"))
let card = try Data(contentsOf: URL(fileURLWithPath: "id-card.jpg"))

do {
    let age = try await nx.ageCheck(person: .jpeg(selfie))            // 1 credit
    print("age:", age.ageBracket ?? "n/a")
} catch let NeetixError.api(status, _, _, _) where status == 404 {
    print("/v1/age not on this deployment yet")
}

let match = try await nx.faceMatch(person: .jpeg(selfie), card: .jpeg(card)) // 2 credits
print(match.verdict, match.result.isSameFace, match.warnings.map(\.code))
print("credits left:", try await nx.balance().balance)
```
