// Root build — declares the plugin versions the Android module's `plugins {}`
// block requests without a version. Only needed because the module used to be
// standalone; see settings.gradle.kts for why this root exists at all.
plugins {
    id("com.android.library") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.24" apply false
}
