plugins {
    kotlin("jvm") version "2.4.21"
    kotlin("plugin.spring") version "2.4.21"
    kotlin("plugin.serialization") version "2.4.21"
    kotlin("plugin.jpa") version "2.4.21"
    id("org.springframework.boot") version "4.2.0"
    id("io.spring.dependency-management") version "1.1.7"
    id("dev.detekt") version "2.0.0-alpha.6"
    jacoco
}

group = "rssapi"
version = "0.1.0"

repositories { mavenCentral() }

kotlin {
    jvmToolchain(26)
    compilerOptions {
        allWarningsAsErrors.set(true)
        freeCompilerArgs.add("-Xjsr305=strict")
        progressiveMode.set(true)
    }
}

// Dependency locking, so the resolved tree is recorded rather than re-resolved
// on every build. Without a lockfile Dependabot infers versions by parsing the
// build files, which reported 17 findings of which 6 had no advisory against
// what actually runs here.
//
// Only the four dependency-bearing configurations are locked. lockAllConfigurations
// would also pin the buildscript, Detekt and JaCoCo trees, so an unrelated
// plugin bump would fail the build for no security reason. The lockfile lives
// beside this file so it travels with the module when the API is cloned out.
//
// Regenerate after an intentional dependency change:
//   ./gradlew dependencies --write-locks
configurations.matching {
    it.name in setOf(
        "compileClasspath",
        "runtimeClasspath",
        "testCompileClasspath",
        "testRuntimeClasspath",
    )
}.configureEach {
    resolutionStrategy.activateDependencyLocking()
}

// kotlinx-serialization ships its BOM, core and json artifacts in lockstep;
// the direct 1.12.0 line would otherwise mix with the BOM-managed 1.11.0 core.
configurations.all {
    resolutionStrategy.eachDependency {
        if (requested.group == "org.jetbrains.kotlinx" &&
            requested.name.startsWith("kotlinx-serialization")
        ) {
            useVersion("1.12.0")
        }
    }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-hateoas")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    // Boot 4 serializes HTTP with Jackson 3. Call sites still construct the
    // Jackson 2 ObjectMapper, so keep this module on the managed BOM line.
    implementation("org.springframework.boot:spring-boot-jackson2")
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.2.0")
    implementation("org.flywaydb:flyway-database-postgresql")
    implementation("org.postgresql:postgresql")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jsoup:jsoup:1.24.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")

    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.boot:spring-boot-starter-security-test")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
    testImplementation("org.mockito.kotlin:mockito-kotlin:6.4.0")
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
    if (System.getenv("PORT") == null) environment("PORT", "3001")
    // OpenAPI docs are off by default (they are reachable through the gateway
    // otherwise), so opt back in for local work.
    environment("SWAGGER_ENABLED", "true")
    environment("SPRING_PROFILES_ACTIVE", "dev")
    // Dev defaults for values SecurityConfig now requires. These live here, not
    // in the application source, so no localhost literal reaches a non-test .kt.
    if (System.getenv("OAUTH_JWKS_URI") == null) {
        environment("OAUTH_JWKS_URI", "http://localhost:3004/oauth/jwks")
    }
    if (System.getenv("OAUTH_ISSUER") == null) {
        environment("OAUTH_ISSUER", "http://localhost/user-api")
    }
}

detekt {
    config.setFrom(files("detekt.yml"))
    buildUponDefaultConfig = true
}

tasks.named("check") { dependsOn("detekt", "jacocoTestCoverageVerification", "jacocoBranchCoverageVerification") }
tasks.withType<Test> { useJUnitPlatform() }

val jacocoExcludes = listOf(
    "rssapi/persist/**",
    "rssapi/db/**",
    "rssapi/config/DataSourceConfig*",
    "rssapi/RssApiApplicationKt*",
)

tasks.named<JacocoReport>("jacocoTestReport") {
    dependsOn("test")
    reports {
        xml.required.set(true)
        html.required.set(true)
    }
}

tasks.named<JacocoCoverageVerification>("jacocoTestCoverageVerification") {
    dependsOn("test")
    violationRules {
        rule {
            limit {
                counter = "LINE"
                value = "COVEREDRATIO"
                minimum = "0.90".toBigDecimal()
            }
        }
    }
}

val jacocoBranchCoverageVerification = tasks.register<JacocoCoverageVerification>("jacocoBranchCoverageVerification") {
    group = "verification"
    description = "Verifies 90% branch coverage."
    dependsOn("test")
    executionData.setFrom(files(layout.buildDirectory.file("jacoco/test.exec")))
    violationRules {
        rule {
            limit {
                counter = "BRANCH"
                value = "COVEREDRATIO"
                minimum = "0.90".toBigDecimal()
            }
        }
    }
}

afterEvaluate {
    tasks.named<JacocoReport>("jacocoTestReport") {
        classDirectories.setFrom(
            files(classDirectories.files.map { dir -> fileTree(dir) { exclude(jacocoExcludes) } }),
        )
    }
    tasks.named<JacocoCoverageVerification>("jacocoTestCoverageVerification") {
        classDirectories.setFrom(
            files(classDirectories.files.map { dir -> fileTree(dir) { exclude(jacocoExcludes) } }),
        )
    }
    val lineDirs = tasks.named<JacocoCoverageVerification>("jacocoTestCoverageVerification").get().classDirectories
    jacocoBranchCoverageVerification.configure {
        classDirectories.setFrom(lineDirs)
    }
}

configurations.matching { it.name == "detekt" }.configureEach {
    resolutionStrategy.eachDependency {
        if (requested.group == "org.jetbrains.kotlin") {
            useVersion("2.4.10")
        }
    }
}
