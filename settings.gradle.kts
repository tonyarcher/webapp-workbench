/**
 * Root Gradle build for the Kotlin API modules.
 *
 * Four Spring Boot APIs live under (apps/<app>/api). Gradle 9 does not read a
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

include(":fitness-api", ":rss-api", ":stock-game-api", ":user-api")

project(":fitness-api").projectDir = file("apps/fitness/api")
project(":rss-api").projectDir = file("apps/rss/api")
project(":stock-game-api").projectDir = file("apps/stock-game/api")
project(":user-api").projectDir = file("apps/user/api")
