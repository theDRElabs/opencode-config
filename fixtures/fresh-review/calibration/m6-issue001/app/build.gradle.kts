plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

// Release signing: self-signed PKCS12 keystore committed to the repo
// (personal sideload app — see AGENTS.md). Passwords live alongside in
// keystore/keystore.properties; PKCS12 uses a single password for store+key.
val releaseKeystoreProperties = java.util.Properties().apply {
    rootProject.file("keystore/keystore.properties").inputStream().use { load(it) }
}

android {
    namespace = "com.drelabs.datacheck"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.drelabs.datacheck"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    signingConfigs {
        create("release") {
            storeFile = rootProject.file(releaseKeystoreProperties.getProperty("storeFile"))
            storeType = releaseKeystoreProperties.getProperty("storeType")
            storePassword = releaseKeystoreProperties.getProperty("storePassword")
            keyAlias = releaseKeystoreProperties.getProperty("keyAlias")
            keyPassword = releaseKeystoreProperties.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.03")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")

    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    implementation("androidx.work:work-runtime-ktx:2.9.1")

    testImplementation("junit:junit:4.13.2")
}
