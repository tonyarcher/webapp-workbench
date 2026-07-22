plugins {
    // Gradle plugins defined here with versions so subprojects can apply them without versions
    kotlin("multiplatform") version "2.4.10" apply false
    kotlin("jvm") version "2.4.10" apply false
    kotlin("plugin.serialization") version "2.4.10" apply false
    id("org.springframework.boot") version "4.1.0" apply false
    id("io.spring.dependency-management") version "1.1.7" apply false
    kotlin("plugin.spring") version "2.4.10" apply false
    kotlin("plugin.jpa") version "2.4.10" apply false
    id("io.gitlab.arturbosch.detekt") version "1.23.6"
    id("org.jlleitschuh.gradle.ktlint") version "14.2.0"
}

detekt {
    // Path to your custom config file
    config.setFrom(files("$rootDir/config/detekt/detekt.yml"))
    buildUponDefaultConfig = true // Use default rules as base
    allRules = false // Activates all rules if true

    // Ignore legacy warnings by generating a baseline
    baseline = file("$rootDir/config/detekt/baseline.xml")
}

// Suppress Node.js deprecation warnings (e.g. url.parse() DEP0169 in Yarn v1) in all child processes
run {
    @Suppress("UNCHECKED_CAST")
    try {
        val processEnv = Class.forName("java.lang.ProcessEnvironment")
        val field = processEnv.getDeclaredField("theEnvironment")
        field.isAccessible = true
        val env = field.get(null) as MutableMap<String, String>
        env["NODE_OPTIONS"] = "--no-deprecation"

        val caseField = processEnv.getDeclaredField("theCaseInsensitiveEnvironment")
        caseField.isAccessible = true
        val caseEnv = caseField.get(null) as MutableMap<String, String>
        caseEnv["NODE_OPTIONS"] = "--no-deprecation"
    } catch (e: Exception) {
        try {
            val env = System.getenv()
            val cl = Class.forName("java.util.Collections\$UnmodifiableMap")
            val field = cl.getDeclaredField("m")
            field.isAccessible = true
            val map = field.get(env) as MutableMap<String, String>
            map["NODE_OPTIONS"] = "--no-deprecation"
        } catch (e2: Exception) {
            // ignore
        }
    }
}
