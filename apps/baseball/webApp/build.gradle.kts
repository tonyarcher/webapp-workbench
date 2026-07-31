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
                devServer = (
                        devServer ?: org.jetbrains.kotlin.gradle.targets.js.webpack.KotlinWebpackConfig.DevServer()
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

// Point to the relative directories where your external styles and web components live
val webComponentsProjectDir = file("../web-components")
val webComponentsDist = file("../web-components/dist")
val externalStylesDir = file("../styles")

/**
 * 1. Register the Vite compiler task cleanly using explicit generic types
 */
val buildWebComponents = tasks.register<Exec>("buildWebComponents") {
    group = "build"
    description = "Compiles the multi-component Lit elements via Vite"

    workingDir = webComponentsProjectDir

    // Checks host OS to invoke correct terminal environment execution strings
    if (org.gradle.internal.os.OperatingSystem.current().isWindows) {
        commandLine("cmd", "/c", "npm run build")
    } else {
        commandLine("npm", "run", "build")
    }

    // Cache management inputs/outputs for incremental builds
    inputs.dir(webComponentsProjectDir.resolve("src"))
    inputs.file(webComponentsProjectDir.resolve("vite.config.ts"))
    inputs.file(webComponentsProjectDir.resolve("tsconfig.json"))
    outputs.dir(webComponentsDist)
}

/**
 * 2. Hook into the Kotlin Wasm resource processing engine
 */
tasks.named<ProcessResources>("wasmJsProcessResources") {
    // Force this step to run only AFTER the web components are compiled
    dependsOn(buildWebComponents)

    // Watch your static stylesheet folder for active modifications
    inputs.dir(externalStylesDir)

    // Pull the compiled Web Components into the virtual 'js' directory structure
    from(webComponentsDist) {
        into("js")
    }

    // Dynamically inject your global stylesheets straight into the final compilation bundle
    from(externalStylesDir) {
        into("")
    }
}

/**
 * 3. Clear cache destinations safely on a clean loop
 */
tasks.clean {
    doFirst {
        // Clears out local Kotlin build destinations automatically
        if (webComponentsDist.exists()) {
            webComponentsDist.deleteRecursively()
        }
    }
}