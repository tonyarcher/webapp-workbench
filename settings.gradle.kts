/*
 * Root Gradle build for the Kotlin API modules.
 *
 * Spring Boot APIs live under apps/<app>/api. Gradle 9 does not read a
 * subproject's own settings file once it is included here, so the toolchain
 * resolver both sides need is configured once, at the root.
 *
 * Each API stays independently buildable: cd apps/<app>/api && gradle build.
 *
 * Commands:
 *   ./gradlew buildAll   JS workspaces + all APIs
 *   ./gradlew buildJvm   Kotlin/Spring APIs only (bootJar)
 *   ./gradlew buildNode  JS workspaces only
 *   ./gradlew projects   included modules
 */
import groovy.json.JsonSlurper

pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

plugins {
    // Resolves the JVM 21 toolchain the APIs compile against (host JDK may differ).
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "webapp-workbench"

// API modules derive from apps.json (apiJars): the service name is the Gradle
// module name and the jar path gives the project dir. Adding an API means
// editing apps.json, not this file. Full catalog validation lives in
// buildSrc (AppCatalog.kt) and runs at project configuration; this reads only
// what settings evaluation needs.
@Suppress("UNCHECKED_CAST")
fun settingsJson(path: java.io.File): Map<String, Any?> {
    if (!path.isFile) error("missing app catalog: ${path.invariantSeparatorsPath}")
    return try {
        JsonSlurper().parse(path) as? Map<String, Any?>
    } catch (error: Exception) {
        error("could not parse app catalog ${path.invariantSeparatorsPath}: ${error.message}")
    } ?: error("could not parse app catalog ${path.invariantSeparatorsPath}: expected an object")
}

val apiModules: List<Pair<String, String>> = run {
    val root = settingsJson(file("apps.json"))
    val jars = root["apiJars"] as? Map<*, *> ?: error("apps.json.apiJars: expected an object")
    if (jars.isEmpty()) error("apps.json.apiJars must not be empty")
    jars.map { (service, jar) ->
        if (service !is String || service.isEmpty() || jar !is String || jar.isEmpty()) {
            error("apps.json.apiJars: expected service names to jar paths")
        }
        val dir = jar.substringBefore("/build/", "")
        if (dir.isEmpty() || dir == jar || !dir.endsWith("/api")) {
            error("apps.json: apiJars[\"$service\"] must look like apps/<app>/api/build/libs/<name>.jar (got \"$jar\")")
        }
        service to dir
    }
}

apiModules.forEach { (name, _) -> include(":$name") }

apiModules.forEach { (name, dir) -> project(":$name").projectDir = file(dir) }
