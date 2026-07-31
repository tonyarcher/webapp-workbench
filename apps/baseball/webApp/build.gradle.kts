import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl

@OptIn(ExperimentalWasmDsl::class)
plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    @OptIn(ExperimentalWasmDsl::class)
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
        getByName("wasmJsMain") {
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
            }
        }
        getByName("wasmJsTest") {
            dependencies {
                implementation(kotlin("test"))
            }
        }
    }
}

val buildWebComponents = tasks.register<Exec>("buildWebComponents") {
    group = "build"
    description = "Builds Lit Web Components using Vite"
    workingDir = file("../webComponents")
    commandLine(
        if (org.gradle.internal.os.OperatingSystem.current().isWindows) {
            listOf("cmd", "/c", "npm", "run", "build")
        } else {
            listOf("npm", "run", "build")
        }
    )
    inputs.dir(file("../webComponents/src"))
    inputs.file(file("../webComponents/package.json"))
    inputs.file(file("../webComponents/vite.config.ts"))
    outputs.file(file("src/wasmJsMain/resources/js/web-components.js"))
}

tasks.named("wasmJsProcessResources") {
    dependsOn(buildWebComponents)
}
