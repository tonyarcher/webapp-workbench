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

group = "userapi"
version = "0.1.0"

repositories {
    mavenCentral()
}

kotlin {
    jvmToolchain(25)
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

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-security")
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
    implementation("com.password4j:password4j:1.8.4")
    implementation("com.eatthepath:java-otp:1.0.0")
    implementation("commons-codec:commons-codec")
    implementation("com.yubico:webauthn-server-core:2.9.0")
    implementation("com.nimbusds:nimbus-jose-jwt:10.10")
    // Floor if a transitive reintroduces Bouncy Castle. webauthn 2.9 does not pull it.
    constraints {
        implementation("org.bouncycastle:bcprov-jdk18on:1.86")
        implementation("org.bouncycastle:bcpkix-jdk18on:1.86")
        implementation("org.bouncycastle:bcpg-jdk18on:1.86")
    }

    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.boot:spring-boot-starter-security-test")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
    testImplementation("org.mockito.kotlin:mockito-kotlin:6.3.0")
    // @DataJpaTest for the rate limiter, which is deliberately a single upsert
    // statement: its correctness under concurrency cannot be faked. Boot 4 ships
    // the test slices as their own starters, separate from the webmvc one.
    testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
    if (System.getenv("PORT") == null) {
        environment("PORT", "3004")
    }
    // OpenAPI docs are off by default (they are reachable through the gateway
    // otherwise), so opt back in for local work.
    environment("SWAGGER_ENABLED", "true")
    environment("SPRING_PROFILES_ACTIVE", "dev")
    // Dev defaults for values that are now required and deployment-specific.
    // These live here, not in Settings, so the application source carries no
    // localhost default that could silently reach production.
    if (System.getenv("OAUTH_ISSUER") == null) {
        environment("OAUTH_ISSUER", "http://localhost/user-api")
    }
    if (System.getenv("WEBAUTHN_RP_ID") == null) {
        environment("WEBAUTHN_RP_ID", "localhost")
    }
    if (System.getenv("WEBAUTHN_ORIGINS") == null) {
        environment("WEBAUTHN_ORIGINS", "http://localhost,http://127.0.0.1")
    }
}

detekt {
    config.setFrom(files("detekt.yml"))
    buildUponDefaultConfig = true
}

tasks.named("check") {
    dependsOn("detekt", "jacocoTestCoverageVerification", "jacocoBranchCoverageVerification")
}

/**
 * Postgres for the JPA slice tests, owned here rather than by the test.
 *
 * The rate limiter's correctness is a property of one Postgres statement, so the
 * test needs a real server and a mock cannot stand in. But the test should not
 * know about Docker: it connects to a port, and this task owns the server's
 * lifecycle. That split is also why there is no Testcontainers dependency --
 * Boot 4.1.1 manages Testcontainers 2.0.5, which deprecates the whole container
 * API, and this module treats a warning as a build failure.
 *
 * Credentials are throwaway and local-only; nothing here is a secret.
 */
val testPostgresPort = 5436
val testPostgresName = "user-api-test-postgres"

/**
 * Where the test Postgres is published, and where the tests connect to.
 *
 * One property for both, because they are the same fact: a port published on one
 * host is not reachable from another. Deriving the JDBC url from the same value
 * is what stops a change to one from silently breaking the other.
 *
 * Loopback by default, so a throwaway database with a known password is not
 * reachable from the LAN. Override it when the daemon is not this machine --
 * `-PtestPostgresHost=10.0.0.63` alongside a DOCKER_HOST pointing at that host.
 * Publishing on every interface instead is not the answer: the container lives
 * only for the length of one test run, and the password is in the build file.
 */
val testPostgresHost = providers.gradleProperty("testPostgresHost").getOrElse("127.0.0.1")

fun docker(vararg args: String): Int = runCatching {
    providers.exec {
        commandLine(listOf("docker") + args)
        // Never throw on exit code: `rm -f` against a container that is not
        // there is a normal 1, and the caller checks what it cares about.
        isIgnoreExitValue = true
    }.result.get().exitValue
}.getOrElse {
    // A missing or unusable binary fails before an exit code exists, so without
    // this the report is a raw Gradle stack trace with no stated cause.
    throw GradleException("Docker is required for the JPA slice tests but 'docker' is not runnable", it)
}

tasks.register("testPostgresStart") {
    description = "Start a throwaway Postgres for the JPA slice tests"
    group = "verification"
    // Never up to date: a cached "started" would leave no server behind.
    outputs.upToDateWhen { false }
    doLast {
        // Clear any container a crashed run left holding the port.
        docker("rm", "-f", testPostgresName)
        val code = docker(
            "run", "-d", "--name", testPostgresName,
            "-e", "POSTGRES_PASSWORD=verify", "-e", "POSTGRES_DB=users",
            // Published on testPostgresHost, which is also what the tests dial.
            "-p", "$testPostgresHost:$testPostgresPort:5432", "postgres:15-alpine",
        )
        check(code == 0) { "could not start $testPostgresName; is Docker running?" }
        // pg_isready rather than a sleep, so the suite does not race the server.
        var ready = false
        for (attempt in 1..60) {
            if (docker("exec", testPostgresName, "pg_isready", "-U", "postgres") == 0) {
                ready = true
                break
            }
            Thread.sleep(500)
        }
        check(ready) {
            // Clear it now rather than waiting for the next run to notice. The
            // finalizer below cannot cover this path: a task that throws never
            // runs its own finalizers, and hanging cleanup off the start task
            // would tear the database down before `test` used it.
            docker("rm", "-f", testPostgresName)
            error("$testPostgresName never accepted connections")
        }
    }
}

tasks.register("testPostgresStop") {
    description = "Stop the throwaway Postgres for the JPA slice tests"
    group = "verification"
    outputs.upToDateWhen { false }
    doLast { docker("rm", "-f", testPostgresName) }
}

tasks.withType<Test> {
    useJUnitPlatform()
    // Only the slice tests read these; the rest of the suite has no database.
    systemProperty("userapi.test.db.url", "jdbc:postgresql://$testPostgresHost:$testPostgresPort/users")
    systemProperty("userapi.test.db.user", "postgres")
    systemProperty("userapi.test.db.password", "verify")
}

tasks.named<Test>("test") {
    // The server is up before tests and torn down after, including on failure.
    dependsOn("testPostgresStart")
    finalizedBy("testPostgresStop")
}

// A build cancelled between the two, or one that dies in compileTestKotlin, runs
// no finalizer at all and leaves the container holding 5436. That is bounded and
// self-healing rather than silent: the leading `rm -f` above clears it on the
// next run. Gradle offers no way to finalise a task that never executed.

val jacocoExcludes = listOf(
    "userapi/persist/**",
    "userapi/accounts/Jpa*",
    "userapi/db/**",
    "userapi/config/StoreConfig*",
    "userapi/UserApiApplicationKt*",
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
