plugins {
    kotlin("jvm") version "2.4.20"
    kotlin("plugin.spring") version "2.4.20"
    kotlin("plugin.serialization") version "2.4.20"
    kotlin("plugin.jpa") version "2.4.20"
    id("org.springframework.boot") version "4.1.1"
    id("io.spring.dependency-management") version "1.1.7"
    id("dev.detekt") version "2.0.0-alpha.6"
    jacoco
}

group = "stockgame"
version = "0.1.0"

repositories { mavenCentral() }

kotlin {
    jvmToolchain(21)
    compilerOptions {
        allWarningsAsErrors.set(true)
        freeCompilerArgs.add("-Xjsr305=strict")
        progressiveMode.set(true)
    }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-hateoas")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    // Boot 4 serializes HTTP with Jackson 3. Call sites still construct the
    // Jackson 2 ObjectMapper, so keep that line on the patched 2.21 BOM.
    implementation("org.springframework.boot:spring-boot-jackson2")
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.1.1")
    implementation("org.flywaydb:flyway-database-postgresql")
    implementation("org.postgresql:postgresql")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")

    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.boot:spring-boot-starter-security-test")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
    testImplementation("org.mockito.kotlin:mockito-kotlin:6.3.0")
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
    if (System.getenv("PORT") == null) environment("PORT", "3005")
}

detekt {
    config.setFrom(files("detekt.yml"))
    buildUponDefaultConfig = true
}

tasks.named("check") { dependsOn("detekt", "jacocoTestCoverageVerification", "jacocoBranchCoverageVerification") }
tasks.withType<Test> { useJUnitPlatform() }

val jacocoExcludes =
    listOf(
        "stockgame/persist/**",
        "stockgame/store/Jpa*",
        "stockgame/store/EntityMapKt*",
        "stockgame/db/**",
        "stockgame/config/DataSourceConfig*",
        "stockgame/StockGameApplicationKt*",
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

val jacocoBranchCoverageVerification =
    tasks.register<JacocoCoverageVerification>("jacocoBranchCoverageVerification") {
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
