# Neetix Liveliness SDKs — local verification.
#
# These recipes ARE the CI: .github/workflows calls the same targets, so what
# runs on a laptop and what runs on a runner cannot drift. Run `just verify`
# before every push.

default:
    @just --list

# Everything a push should satisfy.
verify: contract web react-native flutter swift swift-smoke android android-smoke edge

# Does every SDK still cover its slice of the API? (See tools/contract-check.mjs.)
contract:
    node tools/contract-check.mjs

# Refresh the vendored spec from production, then re-check.
sync-spec:
    curl -fsSL https://liveliness.neetix.in/openapi.yaml -o spec/openapi.yaml
    @git diff --stat -- spec/openapi.yaml
    node tools/contract-check.mjs

web:
    npm install --silent
    cd packages/web && npm run typecheck && npm run build && npm test

react-native:
    cd packages/react-native && npm run typecheck

flutter:
    cd packages/flutter && dart pub get && dart analyze --fatal-infos && dart test

swift:
    cd packages/swift && swift build
    @echo "note: XCTest needs Xcode — 'swift test' runs there / on a CI macos runner;"
    @echo "      'just swift-smoke' covers response decoding without it."

# Decoding smoke test compiled against the library sources (no XCTest/Xcode).
swift-smoke:
    cd packages/swift && swiftc -O Sources/NeetixLiveliness/*.swift \
      ../../tools/swift-decode-smoke.swift -o /tmp/neetix-swift-smoke
    /tmp/neetix-swift-smoke

# Kotlin/JVM compile of the platform-neutral client (no Android SDK needed).
# Prefers the gradle jvm-check project (what CI runs); falls back to a direct
# kotlinc compile with jars cached in /tmp, which needs only `brew install
# kotlin`. Fails loudly if neither toolchain is present — an unverified client
# must not pass as verified.
android:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v gradle >/dev/null; then
      cd packages/android/jvm-check && exec gradle compileKotlin --console=plain
    fi
    command -v kotlinc >/dev/null || { echo "FAIL android: install gradle or kotlin (brew install kotlin)" >&2; exit 1; }
    just _kt-libs
    lib=/tmp/kt-libs-neetix
    plugin=$(just _kt-plugin)
    cd packages/android
    kotlinc -cp "$(ls "$lib"/*.jar | tr '\n' ':')" -Xplugin="$plugin" \
      -d /tmp/neetix-kt-out src/main/kotlin/in/neetix/liveliness/*.kt

# Kotlin decoding smoke test on a plain JVM (no Android SDK, no gradle).
android-smoke:
    #!/usr/bin/env bash
    set -euo pipefail
    command -v kotlinc >/dev/null || { echo "FAIL: brew install kotlin" >&2; exit 1; }
    just _kt-libs
    lib=/tmp/kt-libs-neetix
    plugin=$(just _kt-plugin)
    stdlib=$(dirname "$plugin")/kotlin-stdlib.jar
    cp=$(ls "$lib"/*.jar | tr '\n' ':')
    kotlinc -cp "$cp" -Xplugin="$plugin" -d /tmp/neetix-kt-smoke \
      packages/android/src/main/kotlin/in/neetix/liveliness/*.kt tools/kotlin-decode-smoke.kt
    java -cp "/tmp/neetix-kt-smoke:$cp$stdlib" Kotlin_decode_smokeKt

# Locate kotlinc's lib/ (Homebrew Cellar, or lib/ next to bin/ for a zip
# install) and print the serialization compiler plugin path.
_kt-plugin:
    #!/usr/bin/env bash
    set -euo pipefail
    bin=$(command -v kotlinc)
    real=$(readlink "$bin" || echo "$bin")
    case "$real" in /*) ;; *) real="$(dirname "$bin")/$real" ;; esac
    for dir in "$(dirname "$real")/../lib" "$(dirname "$real")/../libexec/lib"; do
      jar="$dir/kotlinx-serialization-compiler-plugin.jar"
      [ -f "$jar" ] && { echo "$jar"; exit 0; }
    done
    echo "FAIL: kotlinx-serialization compiler plugin not found next to $bin" >&2
    exit 1

# Cache the Kotlin/JVM compile classpath (shared by `android` and `android-smoke`).
_kt-libs:
    #!/usr/bin/env bash
    set -euo pipefail
    lib=/tmp/kt-libs-neetix
    mkdir -p "$lib"
    base=https://repo1.maven.org/maven2
    for a in \
      com/squareup/okhttp3/okhttp/4.12.0/okhttp-4.12.0.jar \
      com/squareup/okio/okio-jvm/3.6.0/okio-jvm-3.6.0.jar \
      org/jetbrains/kotlinx/kotlinx-serialization-json-jvm/1.7.3/kotlinx-serialization-json-jvm-1.7.3.jar \
      org/jetbrains/kotlinx/kotlinx-serialization-core-jvm/1.7.3/kotlinx-serialization-core-jvm-1.7.3.jar \
      org/jetbrains/kotlinx/kotlinx-coroutines-core-jvm/1.9.0/kotlinx-coroutines-core-jvm-1.9.0.jar
    do
      [ -f "$lib/$(basename "$a")" ] || curl -fsSL "$base/$a" -o "$lib/$(basename "$a")"
    done

# The on-device WASM packages. The committed wasm/*.d.ts make the typecheck
# work in a fresh clone; `npm run build` additionally needs the binary itself
# (see packages/edge/README.md — it is produced in the engine repo).
edge:
    cd packages/edge && npm run typecheck
    cd packages/edge-widget && npm run typecheck

# Regenerate the parity table that README.md embeds.
parity:
    node tools/contract-check.mjs --markdown
