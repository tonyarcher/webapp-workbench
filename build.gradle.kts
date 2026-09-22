/**
 * Root build for the Kotlin API modules.
 *
 * Each API stays independently buildable (cd apps/<app>/api && gradle build).
 * This file only ties them together under one invocation:
 *
 *   gradle buildAll    JS workspaces + every API boot jar (API tests/detekt/Jacoco too)
 *   gradle buildJvm    Kotlin/Spring APIs only (bootJar)
 *   gradle buildNode   JS workspaces only (no APIs)
 *   gradle projects    included modules
 *
 * Limit either half to named apps with -Papps (ids, aliases, or folders).
 * An app name selects that app's own service; folder forms select both halves:
 *
 *   gradle buildNode -Papps=rss            # the reader UI
 *   gradle buildJvm -Papps=apps/rss        # the reader's API half
 *   gradle buildJvm -Papps=rss-api         # the API alone
 *
 * The Gradle wrapper is intentionally absent (repo rule: never commit the
 * wrapper jar). Use `gradle` from PATH; a `gradle wrapper` run here would
 * generate untracked wrapper files.
 */
val npmCommand = if (System.getProperty("os.name").lowercase().contains("windows")) {
    "npm.cmd"
} else {
    "npm"
}

/**
 * Per-app host build: npm workspaces in dependency order, the compose
 * services they produce, the Vite `APP_BASE_PATH` (empty = served at root),
 * and an optional npm script for the last workspace (radio-api builds its
 * server bundle with `build:server`). `@stock-game/app` is reached through
 * stock-game's own build script; `user-client` has no build script.
 */
data class HostApp(
    val workspaces: List<String>,
    val services: List<String>,
    val basePath: String = "",
    val buildScript: String = "build",
)

val appMappings: Map<String, HostApp> = mapOf(
    "baseball" to HostApp(listOf("@baseball/web-components", "baseball-tracker"), listOf("baseball"), "/baseball/"),
    "rss-reader" to HostApp(listOf("rss-reader"), listOf("rss-reader"), "/rss-reader/"),
    "rss-api" to HostApp(listOf("rss-api"), listOf("rss-api")),
    "stock-game" to HostApp(listOf("@stock-game/app"), listOf("stock-game"), "/stock-game/"),
    "stock-game-api" to HostApp(listOf("stock-game-api"), listOf("stock-game-api")),
    "lemmy-vertical-scroll" to
        HostApp(listOf("vertical-scroll-core", "lemmy-vertical-scroll"), listOf("lemmy-vertical-scroll")),
    "clipstack" to HostApp(listOf("vertical-scroll-core", "clipstack"), listOf("clipstack")),
    "calendar-sync" to HostApp(listOf("calendar-core", "calendar-sync"), listOf("calendar-sync")),
    "radio-station" to HostApp(listOf("radio-station"), listOf("radio-station")),
    "radio-api" to HostApp(listOf("radio-station"), listOf("radio-api"), buildScript = "build:server"),
    "football" to HostApp(listOf("football-core", "football"), listOf("football"), "/football/"),
    "basketball" to HostApp(listOf("basketball-core", "basketball-tracker"), listOf("basketball"), "/basketball/"),
    "fitness" to HostApp(listOf("fitness-core", "fitness"), listOf("fitness")),
    "fitness-api" to HostApp(listOf("fitness-api"), listOf("fitness-api")),
    "user-web" to HostApp(listOf("user-web"), listOf("user-web")),
    "user-api" to HostApp(listOf("user-api"), listOf("user-api")),
)

/** Build order: shared packages before the apps that load their dist/. */
val buildOrder: List<String> = listOf(
    "baseball",
    "rss-reader",
    "rss-api",
    "stock-game",
    "stock-game-api",
    "lemmy-vertical-scroll",
    "clipstack",
    "calendar-sync",
    "radio-station",
    "radio-api",
    "football",
    "basketball",
    "fitness",
    "fitness-api",
    "user-web",
    "user-api",
)

/** App aliases from scripts/apps.py, for `-Papps` lookups. */
val appAliases: Map<String, String> = mapOf(
    "baseball-tracker" to "baseball",
    "tracker" to "baseball",
    "apps/baseball" to "baseball",
    "rss" to "rss-reader",
    "apps/rss/app" to "rss-reader",
    "apps/rss/api" to "rss-api",
    "stock" to "stock-game",
    "@stock-game/app" to "stock-game",
    "apps/stock-game" to "stock-game",
    "apps/stock-game/app" to "stock-game",
    "apps/stock-game/api" to "stock-game-api",
    "lemmy" to "lemmy-vertical-scroll",
    "apps/lemmy-vertical-scroll" to "lemmy-vertical-scroll",
    "tiktok" to "clipstack",
    "apps/clipstack" to "clipstack",
    "calendar" to "calendar-sync",
    "cal" to "calendar-sync",
    "apps/calendar-sync" to "calendar-sync",
    "radio" to "radio-station",
    "apps/radio-station" to "radio-station",
    "apps/radio-station/server" to "radio-api",
    "apps/football" to "football",
    "apps/basketball" to "basketball",
    "apps/fitness/app" to "fitness",
    "apps/fitness/api" to "fitness-api",
    "auth" to "user-web",
    "accounts" to "user-web",
    "apps/user/app" to "user-web",
    "apps/user/api" to "user-api",
    // Docker-only apps: no host build, but deploy still targets their service.
    "git" to "gitea",
    "hello" to "gateway",
)

/** Apps with no host build (Docker-only); deploy can still target them. */
val dockerOnlyApps: Set<String> = setOf("gitea", "gateway")

/** npm workspace -> repo-relative directory, for `-Papps=apps/rss` folder forms. */
@Suppress("UNCHECKED_CAST")
fun packageJson(path: java.io.File): Map<String, Any?>? =
    groovy.json.JsonSlurper().parse(path) as? Map<String, Any?>

val workspaceDirs: Map<String, String> = fileTree(rootDir) {
    include("apps/**/package.json", "packages/**/package.json")
    exclude("**/node_modules/**")
}.files.mapNotNull { packageFile ->
    val name = packageJson(packageFile)?.get("name") as? String
    val dir = packageFile.parentFile.relativeTo(rootDir).invariantSeparatorsPath
    name?.let { it to dir }
}.toMap()

// -Papps=<names...> (comma/space separated). Empty means every app.
val appFilter: List<String> = (findProperty("apps") as String?)
    ?.split(',', ' ')
    ?.map { it.trim() }
    ?.filter { it.isNotEmpty() }
    ?: emptyList()

/** Plain app ids, aliases, and Docker-only names matching `key`, if any. */
fun exactAppMatch(key: String): String? =
    appMappings.keys.firstOrNull { it == key }
        ?: appAliases[key]
        ?: dockerOnlyApps.firstOrNull { it == key }

/** Apps whose aliases or workspace dirs live under a folder prefix. */
fun folderMatches(key: String): List<String> {
    fun under(value: String, prefix: String) = value == prefix || value.startsWith("$prefix/")
    return appMappings.keys.filter { app ->
        appAliases.filterValues { it == app }.keys.any { under(it, key) } ||
            appMappings.getValue(app).workspaces.any { workspace ->
                workspaceDirs[workspace]?.let { under(it, key) } == true
            }
    }
}

/** Resolve one name to app ids (id, alias, folder prefix, or Docker-only app). */
fun resolveAppName(name: String): List<String> {
    // Like the old normalize_app_name: lowercase, forward slashes, no trailing /.
    val key = name.trim().lowercase().replace('\\', '/').trimEnd('/')
    // Folder forms expand like expand_folders: every alias or workspace dir
    // under the prefix counts, so apps/rss selects both halves.
    val byFolder = if ('/' in key) folderMatches(key) else emptyList()
    val exact = exactAppMatch(key)
    val candidates = if (byFolder.size > 1) byFolder else listOfNotNull(exact ?: byFolder.singleOrNull())
    if (candidates.isEmpty()) {
        error(
            "Unknown app \"$name\"; buildable apps: " +
                appMappings.keys.sorted().joinToString(", ") +
                " (Docker-only: ${dockerOnlyApps.sorted().joinToString(", ")})",
        )
    }
    return candidates
}

/** Resolve -Papps names to buildable app ids (Docker-only names are ignored). */
fun filteredApps(): List<String> {
    if (appFilter.isEmpty()) return emptyList()
    return appFilter.flatMap { resolveAppName(it) }
        .filter { it in appMappings }
        .distinct()
}

/** Apps to build: `-Papps` filtered, or every app in build order. */
fun selectedApps(): List<String> =
    if (appFilter.isEmpty()) buildOrder else buildOrder.filter { it in filteredApps() }

/** npm workspaces for the selected apps (APIs excluded; buildJvm owns them). */
fun selectedJsWorkspaces(): List<String> =
    selectedApps().flatMap { appMappings.getValue(it).workspaces }.distinct()

fun filteredServices(): List<String> =
    selectedApps().flatMap { appMappings.getValue(it).services }.distinct()

// Install before anything else: workspace `prepare` scripts build package
// `dist/` output that the apps compile against.
tasks.register<Exec>("npmInstall") {
    group = "build"
    description = "npm install at the repo root (workspace prepare scripts build package dist/)"
    workingDir = rootDir
    commandLine(npmCommand, "install")
}

// One Exec per workspace so each build can carry its own APP_BASE_PATH.
// Chained in build order: packages finish before the apps that load their
// dist/. The Kotlin APIs are npm workspaces too, but their `build` is
// `gradle bootJar` (buildJvm owns them), so they are not part of this chain.
val appsToBuild = selectedApps().filter { app ->
    appMappings.getValue(app).workspaces.any { workspace ->
        packageJsonBuild(workspace)?.contains("gradle") != true
    }
}
var previousNodeTask: TaskProvider<Exec>? = null
appsToBuild.forEach { app ->
    val mapping = appMappings.getValue(app)
    mapping.workspaces.forEachIndexed { index, workspace ->
        val isLast = index == mapping.workspaces.lastIndex
        val previous = previousNodeTask
        val task = tasks.register<Exec>("buildNode-$app-$index") {
            group = "build"
            description = "Build $workspace for $app"
            dependsOn("npmInstall")
            if (previous != null) {
                dependsOn(previous)
            }
            workingDir = rootDir
            // Only the app workspace carries the subpath base; libraries do not.
            if (isLast && mapping.basePath.isNotEmpty()) {
                environment("APP_BASE_PATH", mapping.basePath)
            } else {
                // Never inherit a stray value (Vite would bake it in).
                environment("APP_BASE_PATH", "")
            }
            commandLine(npmCommand, "run", if (isLast) mapping.buildScript else "build", "-w", workspace)
        }
        previousNodeTask = task
    }
}

tasks.register("buildNode") {
    group = "build"
    description = "Build the selected JS workspaces (per-app APP_BASE_PATH)"
    dependsOn("npmInstall")
    val last = previousNodeTask
    if (last != null) {
        dependsOn(last)
    }
}

tasks.register("buildJvm") {
    group = "build"
    description = "Build Kotlin API boot jars"
    val services = filteredServices()
    dependsOn(
        subprojects
            .filter { appFilter.isEmpty() || it.name in services }
            .map { "${it.path}:bootJar" },
    )
}

tasks.register("buildAll") {
    group = "build"
    description = "Build JS workspaces and every Kotlin API boot jar"
    dependsOn("buildJvm", "buildNode")
}

tasks.register("checkAll") {
    group = "verification"
    description = "Run every Kotlin API's tests, detekt, and Jacoco gates"
    dependsOn(subprojects.map { "${it.path}:check" })
}

tasks.register("usage") {
    group = "help"
    description = "Show the root build and deploy usage"
    doLast {
        println(
            """
            Root build for webapp-workbench (Node + Kotlin).

              gradle buildAll    JS workspaces + every Kotlin API boot jar
              gradle buildJvm    Kotlin APIs only
              gradle buildNode   JS workspaces only
              gradle checkAll    API tests, detekt, Jacoco gates
              gradle deploy      build, render gateway, mint certs, compose up

            Limit either half to one app with -Papps (ids, aliases, or folders):
              gradle buildAll -Papps=rss
              gradle buildJvm -Papps=apps/rss

            ${deployHelp()}
            """.trimIndent(),
        )
    }
}

// ---------------------------------------------------------------------------
// Deploy (the port of scripts/deploy.py + gen_certs.py + render_gateway.py).
// Python is not involved: the gateway config renders here and certs are minted
// here, so build.py / deploy.py are thin `./gradlew` calls.
//
//   gradle deploy -Pargs="rss"        rebuild one service
//   gradle deploy -Pargs="remote"     force the tunneled remote engine
//   gradle deploy -Pargs="down"       stop the stack
//   gradle deploy -Pargs="status"     compose ps
//   gradle deploy -Ppassthrough="-q"  pass args through to compose
//
// Tokens (no leading dashes): local remote no-build build-only down status help
// ---------------------------------------------------------------------------

fun deployHelp(): String = """
Deploy the compose stack with docker compose.

  gradle deploy                     build host artifacts, render the gateway, compose up
  gradle deploy -Pargs="rss"        rebuild and roll out one service
  gradle deploy -Pargs="remote"     force the tunneled remote engine
  gradle deploy -Pargs="down"       stop the stack
  gradle deploy -Pargs="status"     compose ps
  gradle deploy -Ppassthrough="-q"  pass args through to compose

Flags (through deploy.py, or -Pargs on the wrapper):
  --local --remote --no-build --build-only --down --status --help

Apps: ${buildOrder.joinToString(", ")}

Environment: DOCKER_HOST, DOCKER_TUNNEL (default tcp://127.0.0.1:2375),
DEPLOY_TARGET (auto|local|remote). TLS_HOSTS drives the gateway certs.
""".trim()

fun deployTokens(): List<String> {
    val raw = (findProperty("args") as String?) ?: ""
    return raw.split(Regex("\\s+")).map { it.trim() }.filter { it.isNotEmpty() }
}

fun deployHas(token: String): Boolean = deployTokens().contains(token)

val deployFlagTokens: Set<String> = setOf("local", "remote", "no-build", "build-only", "down", "status")

/** Compose services for the names on the deploy line (flags skipped). */
fun deployServices(): List<String> {
    val names = deployTokens()
        .filterNot { it in deployFlagTokens }
        .filterNot { it.startsWith("-") }
    return names.flatMap { name ->
        resolveAppName(name).flatMap { app ->
            appMappings[app]?.services ?: listOf(app)
        }
    }.distinct()
}

/** Compose passthrough args (`-Ppassthrough`). */
fun deployPassthrough(): List<String> {
    val raw = (findProperty("passthrough") as String?) ?: ""
    return raw.split(Regex("\\s+")).map { it.trim() }.filter { it.isNotEmpty() }
}

/** Boot jar paths keyed by compose service (what the API Dockerfiles copy). */
class ApiJars {
    val paths: Map<String, String> = mapOf(
        "user-api" to "apps/user/api/build/libs/user-api-0.1.0.jar",
        "fitness-api" to "apps/fitness/api/build/libs/fitness-api-0.1.0.jar",
        "rss-api" to "apps/rss/api/build/libs/rss-api-0.1.0.jar",
        "stock-game-api" to "apps/stock-game/api/build/libs/stock-game-api-0.1.0.jar",
    )
}

val apiJars = ApiJars()

val composeFile: String = "deploy/docker-compose.yml"

/** The `build` script of an npm workspace, or null when it has none. */
fun packageJsonBuild(workspace: String): String? {
    val dir = workspaceDirs[workspace] ?: return null
    val scripts = packageJson(file("$dir/package.json"))?.get("scripts") as? Map<*, *>
    return scripts?.get("build") as? String
}

/** Start and wait for a process; 1 + "timed out" when it outlives the limit. */
fun startAndWait(builder: ProcessBuilder, timeoutSeconds: Long): Pair<Process?, Pair<Int, String>?> {
    return try {
        val process = builder.start()
        val units = java.util.concurrent.TimeUnit.SECONDS
        if (timeoutSeconds > 0 && !process.waitFor(timeoutSeconds, units)) {
            process.destroyForcibly()
            process to (1 to "timed out")
        } else {
            process to null
        }
    } catch (error: java.io.IOException) {
        null to (1 to error.message.orEmpty())
    }
}

/** Inherited-output run: waits and reports the process exit code (or timeout). */
fun runInherited(builder: ProcessBuilder, timeoutSeconds: Long): Pair<Int, String> {
    builder.inheritIO()
    val (process, failure) = startAndWait(builder, timeoutSeconds)
    return failure ?: (process!!.waitFor() to "")
}

/** Captured-output run: waits, reads everything, reports the exit code. */
fun runCaptured(builder: ProcessBuilder, timeoutSeconds: Long): Pair<Int, String> {
    builder.redirectErrorStream(true)
    val (process, failure) = startAndWait(builder, timeoutSeconds)
    if (failure != null) return failure
    val output = process!!.inputStream.bufferedReader().readText()
    return process.waitFor() to output
}

fun runProcess(
    command: List<String>,
    env: Map<String, String> = emptyMap(),
    inherit: Boolean = false,
    timeoutSeconds: Long = 0,
): Pair<Int, String> {
    val builder = ProcessBuilder(command).directory(rootDir)
    if (env.isNotEmpty()) builder.environment().putAll(env)
    return if (inherit) {
        runInherited(builder, timeoutSeconds)
    } else {
        runCaptured(builder, timeoutSeconds)
    }
}

/** True when a TCP connection to host:port succeeds within the timeout. */
fun tcpOpen(host: String, port: Int, timeoutMs: Int = 800): Boolean = try {
    java.net.Socket().use { socket ->
        socket.connect(java.net.InetSocketAddress(host, port), timeoutMs)
    }
    true
} catch (_: java.io.IOException) {
    false
}

/** One dotenv line as key/value, or null for blanks, comments, and non-pairs. */
fun dotenvLine(line: String): Pair<String, String>? {
    val trimmed = line.trim()
    val eq = trimmed.indexOf('=')
    val blank = trimmed.isEmpty() || trimmed.startsWith("#")
    return if (blank || eq < 0) {
        null
    } else {
        val raw = trimmed.substring(eq + 1).trim()
        val quoted = raw.length >= 2 && raw.first() == raw.last() &&
            (raw.first() == '"' || raw.first() == '\'')
        val value = if (quoted) raw.substring(1, raw.length - 1) else raw
        trimmed.substring(0, eq).trim() to value
    }
}

/** The gateway cert/key files (ca.* and leaf.*) under one directory. */
class GatewayCerts(val dir: java.io.File) {
    val caCrt: java.io.File = java.io.File(dir, "ca.crt")
    val caKey: java.io.File = java.io.File(dir, "ca.key")
    val leafCrt: java.io.File = java.io.File(dir, "leaf.crt")
    val leafKey: java.io.File = java.io.File(dir, "leaf.key")
}

/** deploy/.env values, overridden by the process environment. */
fun gatewayEnv(): Map<String, String> {
    val merged = mutableMapOf<String, String>()
    val envFile = file("deploy/.env")
    if (envFile.exists()) {
        envFile.readLines().forEach { line ->
            dotenvLine(line)?.let { (key, value) -> merged[key] = value }
        }
    }
    System.getenv().forEach { (key, value) -> merged[key] = value }
    return merged
}

fun splitHosts(raw: String): List<String> =
    raw.replace(",", " ").split(Regex("\\s+")).filter { it.isNotEmpty() }

/** Values for the @@TOKEN@@ placeholders in the gateway template. */
fun gatewayTokens(hosts: List<String>): Map<String, String> {
    val tls = hosts.isNotEmpty()
    val redirect = tls && gatewayEnv()["TLS_REDIRECT"] == "1"
    return mapOf(
        "HTTP_LISTEN" to if (redirect) "" else "    listen 80;",
        "TLS_LISTEN" to if (tls) "    listen 443 ssl;" else "",
        "TLS_CERTS" to if (tls) {
            "    ssl_certificate /etc/nginx/certs/leaf.crt;\n" +
                "    ssl_certificate_key /etc/nginx/certs/leaf.key;\n" +
                "    ssl_protocols TLSv1.2 TLSv1.3;"
        } else {
            ""
        },
        "TLS_REDIRECT" to if (redirect) {
            "server {\n    listen 80;\n    server_name _;\n    return 301 https://\$host\$request_uri;\n}\n"
        } else {
            ""
        },
    )
}

/** The token name on a `@@NAME@@` line, or null for ordinary lines. */
fun tokenName(line: String): String? {
    val token = line.trim()
    return if (token.startsWith("@@") && token.endsWith("@@") && token.length > 4) {
        token.substring(2, token.length - 2)
    } else {
        null
    }
}

/** Template lines with known tokens substituted (empty values drop the line). */
fun renderLines(template: String, values: Map<String, String>): List<String> =
    template.split("\n").mapNotNull { line ->
        val value = tokenName(line)?.let { values[it] } ?: return@mapNotNull line
        value.takeIf { it.isNotEmpty() }
    }

/** Render deploy/nginx/default.conf from its template (idempotent). */
fun renderGateway() {
    val template = file("deploy/nginx/default.conf.template").readText()
    val hosts = splitHosts(gatewayEnv()["TLS_HOSTS"] ?: "")
    val output = renderLines(template, gatewayTokens(hosts))
    file("deploy/nginx/default.conf").writeText(output.joinToString("\n"))
    if (hosts.isNotEmpty()) {
        println("==> gateway TLS on for: ${hosts.joinToString(", ")}")
    } else {
        println("==> gateway plain HTTP (TLS_HOSTS empty)")
    }
}

fun findOpenssl(): String {
    if (runProcess(listOf("openssl", "version")).first == 0) return "openssl"
    val bundled = listOf(
        "C:/Program Files/Git/usr/bin/openssl.exe",
        "C:/Program Files (x86)/Git/usr/bin/openssl.exe",
    )
    return bundled.firstOrNull { file(it).exists() }
        ?: error("openssl not found. Install Git for Windows (bundles openssl) or OpenSSL, then retry.")
}

fun opensslRun(openssl: String, args: List<String>) {
    val (code, output) = runProcess(listOf(openssl) + args)
    if (code != 0) error("openssl ${args.first()} failed: ${output.trim()}")
}

fun sanEntry(host: String): String =
    if (host.matches(Regex("\\d+\\.\\d+\\.\\d+\\.\\d+")) || host.contains(":")) "IP:$host" else "DNS:$host"

fun sha256(path: java.io.File): String? =
    if (!path.exists()) {
        null
    } else {
        java.security.MessageDigest.getInstance("SHA-256").digest(path.readBytes())
            .joinToString("") { "%02x".format(it) }
    }

fun leafCovers(openssl: String, hosts: List<String>, leafCrt: java.io.File, leafKey: java.io.File): Boolean {
    val present = leafCrt.exists() && leafKey.exists()
    val fresh = present &&
        runProcess(listOf(openssl, "x509", "-checkend", "0", "-noout", "-in", leafCrt.absolutePath)).first == 0
    val san = if (fresh) {
        runProcess(listOf(openssl, "x509", "-noout", "-ext", "subjectAltName", "-in", leafCrt.absolutePath))
    } else {
        1 to ""
    }
    if (san.first != 0) return false
    val have = san.second.split("\n")
        .asSequence()
        .map { it.trim() }
        .filter { it.isNotEmpty() && !it.startsWith("X509v3") }
        .flatMap { it.split(",") }
        .map { it.trim().lowercase() }
        .toSet()
    return hosts.all { host ->
        val entry = sanEntry(host)
        val name = entry.substringAfter(":").lowercase()
        val want = if (entry.startsWith("IP:")) "ip address:$name" else "dns:$name"
        want in have
    }
}

/** Write the CSR and SAN extension file for a leaf cert; returns their paths. */
fun writeLeafRequest(openssl: String, hosts: List<String>, leafKey: java.io.File): Pair<java.io.File, java.io.File> {
    val csr = java.io.File.createTempFile("gateway-", ".csr")
    val ext = java.io.File.createTempFile("gateway-", ".ext")
    val san = hosts.joinToString(",") { sanEntry(it) }
    opensslRun(
        openssl,
        listOf(
            "req", "-newkey", "rsa:2048", "-nodes",
            "-keyout", leafKey.absolutePath, "-out", csr.absolutePath,
            "-subj", "/CN=${hosts.first()}",
            "-addext", "subjectAltName=$san",
        ),
    )
    ext.writeText("subjectAltName=$san\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n")
    return csr to ext
}

fun mintLeaf(openssl: String, hosts: List<String>, certs: GatewayCerts) {
    val (csr, ext) = writeLeafRequest(openssl, hosts, certs.leafKey)
    try {
        opensslRun(
            openssl,
            listOf(
                "x509", "-req", "-in", csr.absolutePath,
                "-CA", certs.caCrt.absolutePath, "-CAkey", certs.caKey.absolutePath, "-CAcreateserial",
                "-out", certs.leafCrt.absolutePath, "-days", "825", "-extfile", ext.absolutePath,
            ),
        )
    } finally {
        csr.delete()
        ext.delete()
    }
}

/** Copy TLS_CERT_FILE/TLS_KEY_FILE over the leaf; returns true when changed. */
fun installProvidedCert(providedCert: String, providedKey: String, certs: GatewayCerts, hosts: List<String>): Boolean {
    if (providedCert.isEmpty() || providedKey.isEmpty()) {
        error("set both TLS_CERT_FILE and TLS_KEY_FILE, or neither (local-CA flow)")
    }
    val unchanged = sha256(certs.leafCrt) != null && sha256(certs.leafKey) != null &&
        sha256(certs.leafCrt) == sha256(file(providedCert)) && sha256(certs.leafKey) == sha256(file(providedKey))
    if (unchanged) {
        println("==> provided TLS cert already installed for: ${hosts.joinToString(", ")}")
        return false
    }
    file(providedCert).copyTo(certs.leafCrt, overwrite = true)
    file(providedKey).copyTo(certs.leafKey, overwrite = true)
    println("==> installed provided TLS cert for: ${hosts.joinToString(", ")}")
    return true
}

/** Mint the local CA when missing; returns true when it was created. */
fun ensureLocalCa(openssl: String, caKey: java.io.File, caCrt: java.io.File): Boolean {
    if (caKey.exists() && caCrt.exists()) return false
    println("==> minting local gateway CA")
    opensslRun(
        openssl,
        listOf(
            "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", caKey.absolutePath, "-out", caCrt.absolutePath,
            "-days", "825", "-subj", "/CN=workbench-lan-ca",
            "-addext", "basicConstraints=critical,CA:TRUE",
            "-addext", "keyUsage=critical,keyCertSign,cRLSign",
        ),
    )
    return true
}

/** Mint the leaf with the local CA; returns true when it was re-minted. */
fun mintLocalLeaf(env: Map<String, String>, hosts: List<String>, certs: GatewayCerts): Boolean {
    val openssl = findOpenssl()
    // Always ensure the CA before deciding: TLS_FORCE may delete an old leaf.
    val freshCa = ensureLocalCa(openssl, caKey = certs.caKey, caCrt = certs.caCrt)
    if (env["TLS_FORCE"] == "1" || freshCa) {
        // A fresh CA never signed the old leaf: re-mint so devices trust it.
        certs.leafCrt.delete()
        certs.leafKey.delete()
    }
    return if (leafCovers(openssl, hosts, certs.leafCrt, certs.leafKey)) {
        println("==> gateway leaf cert already covers: ${hosts.joinToString(", ")}")
        false
    } else {
        println("==> minting gateway leaf cert for: ${hosts.joinToString(", ")}")
        mintLeaf(openssl, hosts, certs)
        println("==> trust this CA on each device once: ${certs.caCrt.absolutePath}")
        true
    }
}

/** Mint or install the gateway certs; returns true when they changed. */
fun ensureGatewayCerts(): Boolean {
    val env = gatewayEnv()
    val hosts = splitHosts(env["TLS_HOSTS"] ?: "")
    if (hosts.isEmpty()) {
        println("==> TLS_HOSTS empty, no certificates needed")
        return false
    }
    val certs = GatewayCerts(file("deploy/gateway/certs"))
    certs.dir.mkdirs()
    val providedCert = env["TLS_CERT_FILE"] ?: ""
    val providedKey = env["TLS_KEY_FILE"] ?: ""
    return if (providedCert.isNotEmpty() || providedKey.isNotEmpty()) {
        installProvidedCert(providedCert, providedKey, certs, hosts)
    } else {
        mintLocalLeaf(env, hosts, certs)
    }
}

/** Parse a `tcp://host:port` Docker URL, or null. */
fun parseDockerHost(host: String): Pair<String, Int>? {
    val rest = host.removePrefix("tcp://")
    val parts = rest.split(":")
    val port = if (host.startsWith("tcp://") && parts.size == 2) parts[1].toIntOrNull() else null
    return if (port == null) null else parts[0] to port
}

/** Wanted engine from flags/DEPLOY_TARGET, validated. */
fun wantedEngine(): String {
    val wanted = when {
        deployHas("local") -> "local"
        deployHas("remote") -> "remote"
        else -> (System.getenv("DEPLOY_TARGET") ?: "auto").lowercase()
    }
    if (wanted !in setOf("local", "remote", "auto")) {
        error("DEPLOY_TARGET must be auto, local, or remote (got ${System.getenv("DEPLOY_TARGET")}).")
    }
    return wanted
}

/** True when the candidate host answers `docker info` (TCP probe first). */
fun dockerAnswers(host: String): Boolean {
    parseDockerHost(host)?.let { (hostname, port) ->
        if (!tcpOpen(hostname, port)) return false
    }
    val probeEnv = mapOf("DOCKER_HOST" to host, "DOCKER_CONTEXT" to "")
    return runProcess(
        listOf("docker", "info", "--format", "{{.ServerVersion}}"),
        env = probeEnv,
        timeoutSeconds = 4,
    ).first == 0
}

/** The tunneled remote engine, validated. */
fun requireRemote(host: String): String {
    parseDockerHost(host)?.let { (hostname, port) ->
        if (!tcpOpen(hostname, port)) {
            error("Remote Docker tunnel is not listening at $host. Start the SSH tunnel and retry.")
        }
    }
    if (!dockerAnswers(host)) {
        error("Remote Docker at $host did not answer. Is the tunneled daemon running without TLS?")
    }
    return host
}

/** Auto mode: DOCKER_HOST when set, then the tunnel, then local. */
fun autoEngine(existing: String, tunnel: String): String = when {
    existing.isNotEmpty() && dockerAnswers(existing) -> existing
    dockerAnswers(tunnel) -> tunnel
    dockerAnswers("") -> ""
    else -> error(
        "No Docker engine is reachable. Start the SSH tunnel to the remote daemon " +
            "($tunnel) or start local Docker.",
    )
}

/** Engine pick: local/remote/DEPLOY_TARGET, DOCKER_HOST, tunnel, local. */
fun resolveDockerHost(): String? {
    val existing = System.getenv("DOCKER_HOST") ?: ""
    val tunnel = System.getenv("DOCKER_TUNNEL") ?: "tcp://127.0.0.1:2375"
    return when (wantedEngine()) {
        "local" -> {
            if (!dockerAnswers("")) {
                error("Local Docker is not reachable. Start Rancher Desktop / Docker Desktop and retry.")
            }
            ""
        }
        "remote" -> requireRemote(existing.ifEmpty { tunnel })
        else -> autoEngine(existing, tunnel)
    }
}

fun composeArgsFor(services: List<String>): List<String> {
    val extras = deployPassthrough()
    val up = mutableListOf("up", "-d")
    if (!deployHas("no-build")) up.add("--build")
    val base = when {
        deployHas("down") -> listOf("down")
        deployHas("status") -> listOf("ps") + services
        deployHas("build-only") -> listOf("build") + services
        else -> up + services
    }
    return base + extras
}

fun composeCommand(): List<String> {
    if (runProcess(listOf("docker", "compose", "version")).first == 0) {
        return listOf("docker", "compose")
    }
    if (runProcess(listOf("docker-compose", "version")).first == 0) {
        return listOf("docker-compose")
    }
    error("Neither `docker compose` nor `docker-compose` is available on PATH.")
}

/** Mutually exclusive flag pairs, checked in order. */
fun deployConflicts(): List<Triple<String, String, String>> = listOf(
    Triple("local", "remote", "Use only one of --local or --remote."),
    Triple("build-only", "no-build", "Use only one of --build-only or --no-build."),
    Triple("build-only", "status", "--status cannot be combined with --build-only or --no-build."),
    Triple("no-build", "status", "--status cannot be combined with --build-only or --no-build."),
    Triple("down", "build-only", "--down cannot be combined with --build-only, --no-build, or --status."),
    Triple("down", "no-build", "--down cannot be combined with --build-only, --no-build, or --status."),
    Triple("down", "status", "--down cannot be combined with --build-only, --no-build, or --status."),
)

fun deployValidate() {
    deployConflicts().firstOrNull { (left, right, _) -> deployHas(left) && deployHas(right) }
        ?.let { (_, _, message) -> error(message) }
    if (deployHas("down") && deployServices().isNotEmpty()) {
        error("--down stops the whole stack; omit app names.")
    }
}

/** Render the gateway and refresh certs; warns when a rebuild would pick them up. */
fun prepareGateway(services: List<String>) {
    renderGateway()
    if (deployHas("down") || deployHas("status")) return
    val hosts = splitHosts(gatewayEnv()["TLS_HOSTS"] ?: "")
    if (hosts.isEmpty()) return
    val changed = ensureGatewayCerts()
    val gatewayStale = deployHas("no-build") || (services.isNotEmpty() && "gateway" !in services)
    if (changed && gatewayStale) {
        println("==> certs changed: rebuild the gateway (include it in this deploy) to pick them up")
    }
}

tasks.register("deploy") {
    group = "deployment"
    description = "Build host artifacts, render the gateway, and drive docker compose"
    val skipBuild = deployHas("no-build") || deployHas("down") || deployHas("status")
    if (deployHas("help")) {
        doLast { println(deployHelp()) }
        return@register
    }
    deployValidate()
    if (!skipBuild) {
        // Same app selection as -Papps (gradle deploy -Pargs=rss -Papps=rss).
        dependsOn("buildAll")
    }
    doLast {
        val services = deployServices()
        if (!skipBuild) {
            // Jars for the selected services; a bare deploy checks every API.
            val wanted = services.ifEmpty { apiJars.paths.keys.toList() }
            val missing = apiJars.paths.filterKeys { it in wanted }.values.filter { !file(it).exists() }
            if (missing.isNotEmpty()) {
                error("Missing Kotlin boot jars (run `gradle buildAll` first): ${missing.joinToString(", ")}")
            }
        }
        prepareGateway(services)
        val dockerHost = resolveDockerHost()
        val env = mutableMapOf<String, String>()
        if (dockerHost.isNullOrEmpty()) {
            // Match the old docker_env(""): never inherit a remote context.
            env["DOCKER_HOST"] = ""
            env["DOCKER_CONTEXT"] = ""
        } else {
            env["DOCKER_HOST"] = dockerHost
            env["DOCKER_CONTEXT"] = ""
        }
        val args = composeArgsFor(services)
        val compose = composeCommand()
        val label = if (dockerHost.isNullOrEmpty()) "local Docker" else "remote Docker ($dockerHost)"
        println("==> Using $label")
        println("==> ${compose.joinToString(" ")} -f $composeFile ${args.joinToString(" ")}")
        val (code, _) = runProcess(compose + listOf("-f", composeFile) + args, env = env, inherit = true)
        if (code != 0) error("docker compose failed with code $code")
    }
}
