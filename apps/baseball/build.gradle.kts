plugins {
    // Gradle plugins defined here with versions via Version Catalog (gradle/libs.versions.toml)
    alias(libs.plugins.kotlin.multiplatform) apply false
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.spring.boot) apply false
    alias(libs.plugins.spring.dependency.management) apply false
    alias(libs.plugins.kotlin.spring) apply false
    alias(libs.plugins.kotlin.jpa) apply false
    alias(libs.plugins.detekt)
    alias(libs.plugins.ktlint)
}

subprojects {
    apply(plugin = "io.gitlab.arturbosch.detekt")

    System.setProperty("java.version", "21")

    dependencies {
        "detekt"("io.gitlab.arturbosch.detekt:detekt-cli:1.23.8")
        "detekt"("org.jetbrains.kotlin:kotlin-compiler-embeddable:2.0.21")
    }

    detekt {
        config.setFrom(files("$rootDir/config/detekt/detekt.yml"))
        buildUponDefaultConfig = true
        allRules = false
        ignoreFailures = false
        source.setFrom(files("src/commonMain/kotlin", "src/wasmJsMain/kotlin", "src/jvmMain/kotlin", "src/main/kotlin"))
    }

    tasks.withType<io.gitlab.arturbosch.detekt.Detekt>().configureEach {
        jvmTarget = "21"
    }
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
