// Android library module for the Neetix Liveliness SDK.
// NOTE: not compiled in the SDK CI here (no JDK/Gradle in that environment);
// builds under a standard Android/Gradle toolchain (AGP 8.x, Kotlin 1.9.x —
// the kotlin("android") and kotlin("plugin.serialization") plugin versions
// come from the consuming root build / settings pluginManagement).

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    // Required: the client uses @Serializable / MrzRequest.serializer().
    id("org.jetbrains.kotlin.plugin.serialization")
    id("maven-publish")
}

group = "in.neetix"
version = "0.1.0"

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

    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }
}

dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")
}

// Publishing: `./gradlew :liveliness-android:publishReleasePublicationToMavenLocal`
// for a local smoke test, or publish the "release" publication to your chosen
// repository. See sdk/PUBLISHING.md — JitPack needs none of the credentials
// below; Maven Central additionally requires GPG signing + a javadoc jar.
publishing {
    publications {
        register<MavenPublication>("release") {
            groupId = "in.neetix"
            artifactId = "liveliness-android"
            version = project.version.toString()

            // The release component only exists after AGP finishes configuring.
            afterEvaluate { from(components["release"]) }

            pom {
                name.set("Neetix Liveliness Android SDK")
                description.set(
                    "Neetix Liveliness API client for Android (face match, " +
                        "liveliness/PAD, biometric auth, MRZ). CameraX-friendly " +
                        "suspend API.",
                )
                url.set("https://github.com/neetixai/liveliness-sdks")
                licenses {
                    license {
                        name.set("The Apache License, Version 2.0")
                        url.set("https://www.apache.org/licenses/LICENSE-2.0.txt")
                    }
                }
                developers {
                    developer {
                        id.set("neetix")
                        name.set("Neetix")
                        url.set("https://neetix.in")
                    }
                }
                scm {
                    connection.set("scm:git:git://github.com/neetixai/liveliness-sdks.git")
                    developerConnection.set("scm:git:ssh://git@github.com/neetixai/liveliness-sdks.git")
                    url.set("https://github.com/neetixai/liveliness-sdks")
                }
            }
        }
    }
    // No remote repository configured on purpose:
    //  - JitPack (recommended, zero accounts) builds straight from the git tag
    //    using this same "release" publication — nothing more needed here.
    //  - Maven Central's current Central Portal does not accept plain
    //    maven-publish uploads; if/when Central is wanted, add the
    //    com.vanniktech.maven.publish plugin (it wraps signing + the Portal
    //    API). See sdk/PUBLISHING.md.
    // `./gradlew publishToMavenLocal` works as-is for local verification.
}
