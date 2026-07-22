plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.serialization)
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
                implementation(libs.kotlinx.serialization.json)

                // Ktor client for REST APIs
                implementation(libs.ktor.client.core)
                implementation(libs.ktor.client.content.negotiation)
                implementation(libs.ktor.serialization.kotlinx.json)
                implementation(libs.kotlinx.coroutines.core)
                implementation(libs.kotlinx.browser)
                implementation(libs.kotlinx.html)
                implementation(libs.kotlin.css)
            }
        }
        wasmJsTest {
            dependencies {
                implementation(kotlin("test"))
            }
        }
    }
}
