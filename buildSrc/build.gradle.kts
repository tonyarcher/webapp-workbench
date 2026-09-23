plugins {
    `kotlin-dsl`
}

repositories {
    // The org.jetbrains.kotlin.jvm plugin requires a repository
    // where to download the Kotlin compiler dependencies from.
    mavenCentral()
}

dependencies {
    // The root script parses package.json with groovy.json.JsonSlurper and that
    // code moved here unchanged; Groovy comes from the Gradle distribution.
    compileOnly(localGroovy())
}
