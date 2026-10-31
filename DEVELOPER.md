# Developing the Neetix Liveliness SDKs

Seven packages, five languages, one API contract. This file is the map; the
[justfile](justfile) is the source of truth for every command.

```bash
just --list     # all recipes
just verify     # what a push must satisfy
```

## Toolchains

| Package | Needs | Verify with |
|---|---|---|
| `packages/web` | Node >= 18 | `just web` (tsc + `node --test`) |
| `packages/react-native` | Node >= 18 | `just react-native` (tsc) |
| `packages/flutter` | Dart SDK | `just flutter` (`dart analyze --fatal-infos` + `dart test`) |
| `packages/swift` | Swift 5.9+ | `just swift` + `just swift-smoke` |
| `packages/android` | gradle **or** `brew install kotlin` | `just android` + `just android-smoke` |
| `packages/edge`, `packages/edge-widget` | Node >= 18 | `just edge` (tsc) |

The npm packages are **npm workspaces**: run `npm install` once at the repo
root and the cross-package dependencies (`@neetix/liveliness` in React Native,
`@neetix/edge` in the widget) resolve through root `node_modules` symlinks —
no `file:` links, no publish needed to develop.

### Swift and Android have no local unit-test runner — read this before claiming "tested"

- **Swift**: XCTest ships with Xcode, not with the bare toolchain, so
  `swift test` fails locally with *no such module 'XCTest'*. The local gates
  are `swift build` and `just swift-smoke`, which compiles
  [`tools/swift-decode-smoke.swift`](tools/swift-decode-smoke.swift) together
  with the library sources and runs it — that catches the failure that
  actually happens (a `CodingKeys` entry that no longer matches the server's
  snake_case JSON). The XCTest suite in `packages/swift/Tests` runs in Xcode
  or on a CI macOS runner.
- **Android**: the AGP module needs the Android SDK. `just android` compiles
  the same sources as plain Kotlin/JVM (the client is OkHttp +
  kotlinx-serialization + coroutines — nothing Android-specific), and
  `just android-smoke` runs
  [`tools/kotlin-decode-smoke.kt`](tools/kotlin-decode-smoke.kt) on a JVM to
  check every `@SerialName`. Instrumented tests are still pending.

## The contract check

`just contract` ([`tools/contract-check.mjs`](tools/contract-check.mjs)) reads
the vendored `spec/openapi.yaml`, extracts every documented operation, then
scans each SDK's client source for the paths it calls. It fails when an SDK
falls behind its scope. Two exclusion lists carry the reasoning:

- **`EXCLUDED`** — operations no client SDK should wrap (health probes,
  `/metrics`, console OAuth, session-only key minting, admin endpoints, the
  inbound payment webhook, and `/v1/face/verify`, which is a server-side alias
  of `/v1/face/face-match`).
- **`SERVER_ONLY`** — operations that exist in the server SDKs but must never
  be reachable from a shipped app, because an embedded API key is extractable:
  the review queue, tenant settings, link minting/listing, saved workflows,
  AML monitoring, KYT and DSAR export/delete.

Adding an endpoint to the API therefore means one of three things, and the
check makes you pick: implement it, mark it `EXCLUDED`, or mark it
`SERVER_ONLY`.

Refresh the spec with `just sync-spec` (curls `/openapi.yaml` from production
and re-runs the check), then commit the diff with the code that answers it.

## Adding a method

1. `just sync-spec` so the spec in-repo matches the API.
2. Add the response model(s): `packages/web/src/types.ts`,
   `packages/flutter/lib/src/models.dart`,
   `packages/swift/Sources/NeetixLiveliness/Models.swift`,
   `packages/android/src/main/kotlin/in/neetix/liveliness/Models.kt`.
   Keep the field names as the API sends them (snake_case on the wire,
   platform-idiomatic in the model) and keep optional fields optional — the
   server adds keys over time.
3. Add the method to each client, in the same section order the other
   platforms use, with a doc comment that states the **credit cost** and any
   surprising status code.
4. Public (unauthenticated) endpoints must pass the "no auth" flag through the
   transport — `auth: false` / `authenticated: false`. A leaked key on a
   public endpoint is a real bug: the web test suite asserts this.
5. Extend the decode smoke tests + `packages/flutter/test/surface_test.dart`
   and `packages/web/test/client.test.mjs`.
6. `just verify`.

## House style

- **Zero runtime dependencies** in the TypeScript packages (fetch + Blob only).
  Dart uses `http`, Android uses OkHttp + kotlinx-serialization, Swift uses
  Foundation alone.
- Doc comments carry the credit cost and the failure modes, not restatements
  of the signature.
- No claim in a README that `just verify` does not prove. Certification,
  accuracy and benchmark numbers belong to the API repo's `EVAL.md`, with its
  caveats attached.
