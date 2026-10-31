// Root Gradle project — exists so JitPack can build the Android library
// straight from a git tag (PUBLISHING.md §4, Option A: zero accounts, no
// signing key). The Kotlin sources are platform-neutral and are also
// compile-checked without the Android SDK by packages/android/jvm-check
// (`just android`), which is a standalone build and deliberately NOT included
// here — including it would make every root build need the Android SDK twice.

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "liveliness-sdks"

include(":liveliness-android")
project(":liveliness-android").projectDir = file("packages/android")

// packages/android/capture/ (CameraX + Play Integrity) is deliberately NOT
// included. It is pre-release and has never been compiled here, and a module
// in this build that fails to configure would take the whole JitPack build —
// and therefore the published client — down with it. Consumers who want the
// capture view add that directory to their own app project.
