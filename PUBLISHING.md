# Publishing the Neetix Liveliness SDKs

Every package is publish-ready: one command each, once the owner has created
the accounts listed per registry. **Nothing has been published yet** — this
repo is the canonical source, and the public URLs in every manifest
(`package.json` `repository`, `pubspec` `repository`, podspec `source`, Maven
POM/scm) already point at `github.com/neetixai/liveliness-sdks`.

Versions move in **lockstep** — currently `0.2.0` everywhere. See
[Version bumps](#version-bumps).

Before any publish:

```bash
just verify          # contract check + every SDK; must be green
```

---

## 1. npm — `@neetix/liveliness`, `@neetix/liveliness-react-native`, `@neetix/edge`, `@neetix/edge-widget`

**Owner must create (once):**
- npmjs.com account + the **`@neetix` organization** (npmjs.com → Add
  Organization; the free tier covers public packages).
- An **Automation** granular access token for CI, or just `npm login` locally.

**Publish (order matters — the dependents resolve by version range):**

```bash
npm publish -w @neetix/liveliness                  # core; others depend on it
npm publish -w @neetix/liveliness-react-native     # dep: @neetix/liveliness ^0.2.0
npm publish -w @neetix/edge                        # on-device wasm
npm publish -w @neetix/edge-widget                 # dep: @neetix/edge ^0.2.0
```

Notes:
- `publishConfig.access: public` is set — required for a scoped package's
  first publish.
- `prepublishOnly` runs typecheck + build (+ `npm test` on the core), so a
  broken package cannot be published by accident.
- The repo is an **npm workspace**: locally the dependents resolve through the
  root `node_modules` symlinks, so `just verify` works before anything is on
  npm.
- **`@neetix/edge` needs its wasm artefacts** in `packages/edge/wasm/` to
  build. They are produced in the engine repo and are gitignored here — see
  [packages/edge/README.md](packages/edge/README.md). The publishable default
  is the clean build (`hasRecognizer === false`): do **not** ship a bundle
  built with the prototype recognizer weights, which are non-commercial.

## 2. pub.dev — `neetix_liveliness`

**Owner must create (once):**
- A Google account signed in to pub.dev (`dart pub publish` opens a browser
  OAuth flow; there is no token to pre-provision).
- Recommended: a **verified publisher** `neetix.in` (pub.dev → Create
  publisher; proves domain control via Google Search Console), then publish
  under it rather than a personal account.

```bash
cd packages/flutter && dart pub publish
```

`dart pub publish --dry-run` must report 0 warnings first.

## 3. iOS — SPM (no account) + CocoaPods `NeetixLiveliness`

**SPM works with zero accounts** — consumers add the package by git URL. One
caveat: SPM's *versioned* resolution expects `Package.swift` at the **root** of
the repo it points at, and here it lives in `packages/swift/`. Options:

- consumers use branch-based resolution
  (`.package(url: "…/liveliness-sdks", branch: "main")`), which works today; or
- publish a thin `neetixai/liveliness-swift` mirror whose root is
  `packages/swift/` (a push mirror or a release workflow), which unlocks
  `.package(url:, from: "0.2.0")`.

**CocoaPods — owner must create (once):**

```bash
pod trunk register <email> 'Neetix' --description='laptop'
# then click the link in the confirmation email
```

**Publish** (needs the `0.2.0` git tag to exist first):

```bash
cd packages/swift && pod trunk push NeetixLiveliness.podspec
```

The podspec mirrors `Package.swift` (iOS 14 / macOS 12, Swift 5.9, Apache-2.0)
and its `source_files` are relative to the repo root, i.e. prefixed
`packages/swift/`. `pod spec lint` only passes once the tag is pushed.

## 4. Android — JitPack (recommended) or Maven Central

**Option A — JitPack (zero accounts).** No token, no signing: JitPack builds
public GitHub repos on demand from the `release` publication already configured
in `packages/android/build.gradle.kts`.

Repo prerequisites — **DONE** (2026-10-31): the Gradle wrapper (8.9), a root
`settings.gradle.kts` mapping `:liveliness-android` to `packages/android`, a
root `build.gradle.kts` pinning AGP 8.5.2 / Kotlin 1.9.24, and `jitpack.yml`
with `jdk: openjdk17` and the explicit install command.

Verified by running JitPack's own install command locally:

```bash
./gradlew :liveliness-android:publishToMavenLocal -x test --no-daemon
# BUILD SUCCESSFUL -> ~/.m2/.../in/neetix/liveliness-android/0.2.0/
#   liveliness-android-0.2.0.aar  (classes.jar 440KB, in/neetix/liveliness/*)
#   + -sources.jar, .pom, .module
```

`packages/android/capture/` is deliberately **not** in `settings.gradle.kts`:
it is pre-release and has never been compiled here, and a module that fails to
configure would take the whole JitPack build — and so the published client —
down with it. `packages/android/jvm-check` also stays out; it is a standalone
Kotlin/JVM build (`just android`) that must not need the Android SDK.

"Publish" is then just the tag:

```bash
git tag 0.2.0 && git push origin 0.2.0
```

**PUBLISHED and consumer-verified (0.2.0, 2026-10-31).** The real coordinates
are **`com.github.neetixai:liveliness-sdks:0.2.0`** — note this is *not*
`com.github.neetixai.liveliness-sdks:liveliness-android`, which is what the
multi-module convention would suggest. JitPack found a single artifact
(`in.neetix:liveliness-android:0.2.0`) and republished it under the repo-level
name. Always read the tail of `build.log` for the coordinates JitPack actually
minted rather than predicting them:

```
https://jitpack.io/com/github/neetixai/liveliness-sdks/0.2.0/build.log
```

Consumer setup:

```kotlin
// settings.gradle.kts
repositories { maven { url = uri("https://jitpack.io") } }
// build.gradle.kts
implementation("com.github.neetixai:liveliness-sdks:0.2.0")
```

Verified from a throwaway project: resolves the 403KB AAR plus every transitive
dependency (okhttp 4.12.0, kotlinx-serialization-json 1.6.3,
kotlinx-coroutines 1.8.0, okio, kotlin-stdlib).

The `in.neetix` group in `packages/android/build.gradle.kts` only takes effect
for a Maven Central release (Option B).

**Option B — Maven Central (real `in.neetix` coordinates).** Needs a Sonatype
**Central Portal** account, the **`in.neetix` namespace** verified by a DNS TXT
record on neetix.in, and a **GPG key** on keys.openpgp.org (Central requires
signed artefacts + a javadoc jar). The Portal does not accept plain
`maven-publish` uploads — add `com.vanniktech.maven.publish` and run
`./gradlew publishAndReleaseToMavenCentral`.

---

## Version bumps

All seven packages share one version. Bump them together even when only one
changed — the dependents reference each other by range, and the git tag drives
the podspec, SPM and JitPack.

Pre-1.0: a breaking API change bumps **minor** (`0.3.0`); fixes and additions
bump **patch** (`0.2.1`). From 1.0.0, standard semver.

A bump touches exactly:

1. `packages/web/package.json`
2. `packages/react-native/package.json` — `version` **and** the
   `@neetix/liveliness` range
3. `packages/edge/package.json`
4. `packages/edge-widget/package.json` — `version` **and** the `@neetix/edge`
   range
5. `packages/flutter/pubspec.yaml` + a `CHANGELOG.md` entry
6. `packages/swift/NeetixLiveliness.podspec` (`s.version`)
7. `packages/android/build.gradle.kts` (`version`)
8. the git tag `X.Y.Z`, pushed after the version commit

Release order: `just verify` → tag → npm (core → RN → edge → edge-widget) →
pub.dev → CocoaPods. JitPack and SPM need only the tag.

## Blocked on the owner

| Registry | Needed before the one-command publish works |
|---|---|
| npm (4 packages) | npmjs account + `@neetix` org; `npm login` or an automation token |
| pub.dev | Google sign-in (browser flow); optional `neetix.in` verified publisher |
| CocoaPods | `pod trunk register` email verification + the `0.2.0` tag |
| SPM (versioned) | decide: branch-based resolution, or a `liveliness-swift` root mirror |
| JitPack | **DONE** — no account; published as `com.github.neetixai:liveliness-sdks` |
| Maven Central | Central Portal account + DNS-verified `in.neetix` + GPG key + vanniktech plugin |
| `@neetix/edge` (match) | production recognizer weights — licensed or self-trained |
