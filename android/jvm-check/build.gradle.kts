// JVM compile-check for the Android client sources (no Android SDK needed).
// The library is plain OkHttp + kotlinx-serialization + coroutines, so the
// sources compile as Kotlin/JVM — CI uses this to catch compile-breakers.
plugins {
    kotlin("jvm") version "2.1.0"
    kotlin("plugin.serialization") version "2.1.0"
}
repositories { mavenCentral() }
kotlin { sourceSets["main"].kotlin.srcDir("../src/main/kotlin") }
dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
}
