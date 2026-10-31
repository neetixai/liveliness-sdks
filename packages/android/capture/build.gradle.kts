// OPTIONAL Android-only capture module for the Neetix Liveliness SDK.
//
// This module contains real Android UI/camera code (CameraX, Play Integrity)
// and therefore REQUIRES the Android SDK + AGP to build. It is deliberately
// NOT part of android/jvm-check — that check compiles only ../src/main/kotlin
// (the pure-JVM API client) and must stay Android-free.
//
// PRE-RELEASE / UNCOMPILED: like the parent module, this has not been
// compiled in this repo's CI (no Android toolchain there — see
// .github/workflows/ci.yml). Build it inside your app project and report
// issues.

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "in.neetix.liveliness.capture"
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
    implementation("androidx.camera:camera-core:1.3.4")
    implementation("androidx.camera:camera-camera2:1.3.4")
    implementation("androidx.camera:camera-lifecycle:1.3.4")
    implementation("androidx.camera:camera-view:1.3.4")
    implementation("com.google.android.play:integrity:1.4.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")

    // Pairs with the JVM client module (NeetixClient + Attestation). If you
    // include both as Gradle modules:
    //   implementation(project(":neetix-liveliness"))
}
