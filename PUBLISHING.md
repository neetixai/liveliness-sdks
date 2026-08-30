# Publishing the Neetix Liveliness SDKs

Every package is prepared so that publishing is one command — once the owner
has created the accounts/tokens listed per registry. Nothing here has been
published yet.

All public-facing URLs (package.json `repository`, pubspec `repository`,
podspec `source`, Maven POM/scm) point at the public mirror
**github.com/neetixai/liveliness-sdks**, assumed to contain this `sdk/`
directory's contents at its root (`web/`, `react-native/`, `swift/`,
`flutter/`, `android/`). If the layout differs, fix those URLs/paths first —
each spot is called out below.

Versions are currently `0.1.0` everywhere. Keep the five SDKs in version
lockstep (see [Version bumps](#version-bumps)).

---

## 1. Web — npm (`@neetix/liveliness-web`)

**Owner must create (once):**
- npmjs.com account + the **`@neetix` organization** (npmjs.com → Add
  Organization; free tier is fine for public packages).
- An **Automation** granular access token (npmjs.com → Access Tokens) for CI,
  or just `npm login` locally.

**Publish:**
```bash
cd sdk/web
npm publish        # prepublishOnly runs typecheck + build; publishConfig sets --access public
```

Notes:
- `publishConfig.access: public` is already in package.json (required for the
  first publish of a scoped package).
- Verified here: `npm run build` (tsc) clean; `npm pack --dry-run` packs 21
  files, 18.3 kB (dist/ + src/ + README + LICENSE), no strays.

## 2. React Native — npm (`@neetix/liveliness-react-native`)

Same account/org/token as the web package.

**Publish (web must be published first):** the dependency is
`"@neetix/liveliness-web": "^0.1.0"` (a real version range, not the local
`file:../web` link), so this package is publish-ready but will only install
cleanly for consumers after `@neetix/liveliness-web@0.1.0` exists on npm.

```bash
cd sdk/react-native
npm publish
```

Notes:
- peerDependencies: `react >= 17`, `react-native >= 0.68`. Camera is BYO.
- Local development still resolves `../web` through the existing
  `node_modules` symlink / package-lock; if you reinstall from scratch before
  the web package is on npm, use `npm i ../web` or an `overrides` entry.
- Verified here: `tsc --noEmit` clean, `tsc` build clean, `npm pack --dry-run`
  packs 6 files, 6.3 kB.

## 3. Flutter/Dart — pub.dev (`neetix_liveliness`)

**Owner must create (once):**
- A Google account signed in to pub.dev (first `dart pub publish` opens a
  browser OAuth flow; no token to pre-provision).
- Recommended: a **verified publisher** `neetix.in` (pub.dev → Create
  publisher; requires proving control of the domain via Google Search
  Console), then publish under it instead of the personal account.

**Publish:**
```bash
cd sdk/flutter
dart pub publish
```

Verified here — `dart pub publish --dry-run` (Dart 3.2.4) passes:
`Package has 0 warnings.` (archive: CHANGELOG, LICENSE, README, lib/, test/,
pubspec — 7 kB compressed).

## 4. iOS — CocoaPods (`NeetixLiveliness`) + SPM

**SPM already works with zero accounts:** consumers add the package by git
URL. Caveat: SPM's versioned resolution requires `Package.swift` at the
**root** of the repo it points at, so the public repo either needs the swift
package at its root or a dedicated `neetixai/liveliness-swift` mirror;
branch-based resolution (`.package(url:, branch:)`) works regardless.

**CocoaPods — owner must create (once):**
- A CocoaPods **trunk session** (email-based, no website account):
  ```bash
  pod trunk register <email> 'Neetix' --description='laptop'
  # click the link in the confirmation email
  ```
- A git tag `0.1.0` on the public repo (the podspec's `:tag`).

**Publish:**
```bash
cd sdk/swift
pod trunk push NeetixLiveliness.podspec
```

Notes:
- The podspec mirrors Package.swift: iOS 14 / macOS 12, Swift 5.9, sources
  `swift/Sources/NeetixLiveliness/**/*.swift`, Apache-2.0. Paths assume the
  monorepo layout (swift SDK under `swift/`); drop the `swift/` prefixes if
  publishing from a root-level swift repo — see the note at the top of the
  podspec.
- Verified here: `pod ipc spec` renders valid JSON (syntax OK). `pod spec
  lint` needs the public repo + tag to exist, so it runs at publish time.

## 5. Android — JitPack (recommended) or Maven Central

`sdk/android/build.gradle.kts` now carries a `maven-publish` config:
publication `release`, **groupId `in.neetix`, artifactId `liveliness-android`,
sources jar** (AGP `singleVariant("release") { withSourcesJar() }`), full POM
(Apache-2.0, scm). **Not compiled here — no JDK/Gradle in this environment;
verification pending toolchain** (`./gradlew publishToMavenLocal` on any
machine with Android Studio's JDK). Also fixed while in there: added the
`org.jetbrains.kotlin.plugin.serialization` plugin, which the client's
`@Serializable` models require.

**Option A — JitPack (zero accounts, recommended):**
- No account, no token, no signing. JitPack builds public GitHub repos on
  demand: first request of `com.github.neetixai:liveliness-sdks:0.1.0`
  triggers the build.
- Repo prerequisites (one-time, in the public repo): a Gradle **wrapper**, a
  root `settings.gradle.kts` including the module (e.g.
  `include(":android")` + `project(":android").name = "liveliness-android"`),
  a root build declaring the AGP/Kotlin plugin versions, and a `jitpack.yml`
  pinning `jdk: openjdk17`. The module itself is standalone today and has no
  root project around it.
- "Publish" = push the tag:
  ```bash
  git tag 0.1.0 && git push origin 0.1.0
  ```
- Consumers use `maven { url "https://jitpack.io" }` and coordinates
  `com.github.neetixai.liveliness-sdks:liveliness-android:0.1.0` (JitPack
  group is `com.github.<owner>`, not `in.neetix`).

**Option B — Maven Central (real `in.neetix` coordinates):**
- Sonatype **Central Portal** account (central.sonatype.com) + **namespace
  `in.neetix`** verified via a DNS TXT record on neetix.in.
- A **GPG key** published to keys.openpgp.org (Central requires signed
  artifacts + a javadoc jar).
- The Portal does not accept plain `maven-publish` uploads; add the
  `com.vanniktech.maven.publish` plugin (wraps signing, javadoc jar and the
  Portal API) and run:
  ```bash
  ./gradlew publishAndReleaseToMavenCentral
  ```

---

## Version bumps

- **Semver, in lockstep**: all five SDKs share one version (currently
  `0.1.0`). Bump them together even if only one changed — the RN package
  depends on the web package by version, and the git tag drives both the
  podspec and JitPack.
- Pre-1.0: breaking API change → bump **minor** (0.2.0); fixes/additions →
  bump **patch** (0.1.1). At 1.0.0, standard semver.
- A bump touches exactly these places:
  1. `web/package.json` `version`
  2. `react-native/package.json` `version` **and** its
     `@neetix/liveliness-web` range
  3. `flutter/pubspec.yaml` `version` + a `CHANGELOG.md` entry
  4. `swift/NeetixLiveliness.podspec` `s.version`
  5. `android/build.gradle.kts` `version = "..."`
  6. Git tag `X.Y.Z` on the public repo (podspec `:tag`, JitPack, SPM), pushed
     after the version commit.
- Publish order per release: tag → npm web → npm RN → pub.dev → pod trunk.
  (JitPack/SPM need only the tag.)

## Blocked on the owner (summary)

| Registry | Needed before one-command publish works |
|---|---|
| npm (web + RN) | npmjs account + `@neetix` org; `npm login` or automation token |
| pub.dev | Google account sign-in (browser flow); optional `neetix.in` verified publisher |
| CocoaPods | `pod trunk register` email verification; `0.1.0` tag on the public repo |
| SPM | Nothing (git URL) — but versioned resolution needs `Package.swift` at a repo root |
| JitPack | Nothing account-wise; public repo needs root Gradle wrapper/settings + tag |
| Maven Central | Central Portal account + `in.neetix` DNS-verified namespace + GPG key + vanniktech plugin |

Also confirm the actual layout of `github.com/neetixai/liveliness-sdks` — no
reference to it exists inside this repo; every URL above assumes it mirrors
`sdk/` at its root.
