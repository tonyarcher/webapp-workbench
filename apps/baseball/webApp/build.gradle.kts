plugins {
    kotlin("multiplatform")
    kotlin("plugin.serialization")
}

kotlin {
    wasmJs {
        binaries.executable()
        browser {
            commonWebpackConfig {
                devServer =
                    (
                        devServer ?: org.jetbrains.kotlin.gradle.targets.js.webpack.KotlinWebpackConfig
                            .DevServer()
                    ).copy(
                        port = 3000,
                    )
            }
            testTask {
                useMocha {
                    // Disable Mocha's 2s default timeout; long-running simulation tests
                    // (up to 3×1000 play events) need more time in the browser
                    timeout = "0"
                }
            }
        }
    }

    sourceSets {
        val wasmJsMain by getting {
            dependencies {
                implementation(project(":shared"))
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")

                // Ktor client for REST APIs
                implementation("io.ktor:ktor-client-core:3.5.1")
                implementation("io.ktor:ktor-client-content-negotiation:3.5.1")
                implementation("io.ktor:ktor-serialization-kotlinx-json:3.5.1")
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
                implementation("org.jetbrains.kotlinx:kotlinx-browser:0.5.0")
                implementation("org.jetbrains.kotlinx:kotlinx-html:0.12.0")
                implementation("org.jetbrains.kotlin-wrappers:kotlin-css:2026.7.0")
            }
        }
        val wasmJsTest by getting {
            dependencies {
                implementation(kotlin("test"))
            }
        }
    }
}
