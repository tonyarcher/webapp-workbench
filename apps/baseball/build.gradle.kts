plugins {
    // Gradle plugins defined here with versions so subprojects can apply them without versions
    kotlin("multiplatform") version "2.4.0" apply false
    kotlin("jvm") version "2.4.0" apply false
    kotlin("plugin.serialization") version "2.4.0" apply false
    id("org.springframework.boot") version "4.1.0" apply false
    id("io.spring.dependency-management") version "1.1.7" apply false
    kotlin("plugin.spring") version "2.4.0" apply false
    kotlin("plugin.jpa") version "2.4.0" apply false
    id("io.gitlab.arturbosch.detekt") version "1.23.6"
}

configure(subprojects.filter { it.name in listOf("webApp", "shared") }) {
    apply(plugin = "io.gitlab.arturbosch.detekt")

    detekt {
        toolVersion = "1.23.6"
        config.setFrom(files("$rootDir/config/detekt/detekt.yml"))
        buildUponDefaultConfig = true
    }

    configurations.matching { it.name.startsWith("detekt") }.all {
        resolutionStrategy.eachDependency {
            if (requested.group == "org.jetbrains.kotlin") {
                useVersion("1.9.23")
            }
        }
    }

    tasks.withType<io.gitlab.arturbosch.detekt.Detekt>().configureEach {
        jvmTarget = "21"
    }
}
