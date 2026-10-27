buildscript {
    configurations.classpath {
        resolutionStrategy.eachDependency {
            if (requested.group == "tools.jackson.core" &&
                requested.name in setOf("jackson-core", "jackson-databind")
            ) {
                useVersion("3.1.7")
            }
            if (requested.group == "org.apache.commons" && requested.name == "commons-lang3") {
                useVersion("3.18.0")
            }
        }
    }
}

plugins {
    kotlin("jvm") version "2.4.21"
    kotlin("plugin.spring") version "2.4.21"
    kotlin("plugin.serialization") version "2.4.21"
    kotlin("plugin.jpa") version "2.4.21"
    id("org.springframework.boot") version "4.1.2"
    id("io.spring.dependency-management") version "1.1.7"
    id("dev.detekt") version "2.0.0-alpha.6"
    jacoco
}

group = "radioapi"
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

// The security floors below pin the Tomcat and Jackson core/databind
// artifacts that carried the advisories osv-scanner reported:
// GHSA-9xv2-5v5q-p794, GHSA-gcx9-497g-6cp6 and GHSA-h3x4-894j-xpx5 (critical)
// on tomcat-embed-core, and GHSA-wv8q-qhhj-9h54, GHSA-cxp5-3px4-pw24,
// GHSA-p6pp-m3f8-5c89 and GHSA-7hhh-6rmp-j9qf on the Jackson 2 and Jackson 3
// core and databind. Boot 4.1.2's BOM names these patched versions today; the
// rule keeps a BOM move or a transitive request from walking them back.
//
// Jackson core is pinned alongside databind: overriding only databind leaves
// core on the BOM's vulnerable patch.
//
// This has to be eachDependency, registered after the plugin's own rule.
// resolutionStrategy.force, a lockfile edit, and the plugin's overrides map
// are each substituted back to the managed BOM version. eachDependency is the
// same kind of rule the plugin installs, and being registered later it wins.
configurations.all {
    resolutionStrategy.eachDependency {
        when {
            requested.group == "org.apache.tomcat.embed" &&
                requested.name in setOf("tomcat-embed-core", "tomcat-embed-websocket") -> useVersion("11.0.27")

            requested.group == "com.fasterxml.jackson.core" &&
                requested.name in setOf("jackson-core", "jackson-databind") -> useVersion("2.21.7")

            requested.group == "tools.jackson.core" &&
                requested.name in setOf("jackson-core", "jackson-databind") -> useVersion("3.1.7")
        }
    }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.springframework.boot:spring-boot-jackson2")
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation("org.flywaydb:flyway-database-postgresql")
    implementation("org.postgresql:postgresql")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")

    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
    if (System.getenv("PORT") == null) environment("PORT", "3002")
    environment("SPRING_PROFILES_ACTIVE", "dev")
}

detekt {
    config.setFrom(files("detekt.yml"))
    buildUponDefaultConfig = true
}

tasks.named("check") { dependsOn("detekt", "jacocoTestCoverageVerification", "jacocoBranchCoverageVerification") }
tasks.withType<Test> { useJUnitPlatform() }

val jacocoExcludes = listOf(
    "radioapi/persist/**",
    "radioapi/store/**",
    "radioapi/db/**",
    "radioapi/config/**",
    "radioapi/web/HealthController*",
    "radioapi/RadioApiApplication*",
    "radioapi/RadioApiApplicationKt*",
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
