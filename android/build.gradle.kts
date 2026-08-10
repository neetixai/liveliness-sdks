// Android library module for the Neetix Liveliness SDK.
//
// PRE-RELEASE / UNCOMPILED: this module has not been compiled in this repo's
// CI (no JDK/Android toolchain there — see .github/workflows/ci.yml). It is
// idiomatic Kotlin targeting a standard AGP 8.x / Kotlin 1.9+ toolchain;
// build it inside your app project and report issues.

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "in.neetix.liveliness"
    compileSdk = 34

    defaultConfig {
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")
}
