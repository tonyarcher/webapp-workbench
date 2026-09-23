package workbench

import org.gradle.api.Project

/*
 * Deploy support for the root `deploy` task: flag parsing, host process
 * runners, gateway config rendering, and TLS cert minting/installing. This is
 * the port of scripts/deploy.py + gen_certs.py + render_gateway.py; Python is
 * not involved. Extracted from the root build.gradle.kts unchanged; `Project`
 * extensions stand in for the script's implicit receiver so call sites stay
 * identical.
 */

fun Project.deployHelp(): String = """
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

fun Project.deployTokens(): List<String> {
    val raw = (findProperty("args") as String?) ?: ""
    return raw.split(Regex("\\s+")).map { it.trim() }.filter { it.isNotEmpty() }
}

fun Project.deployHas(token: String): Boolean = deployTokens().contains(token)

val deployFlagTokens: Set<String> = setOf("local", "remote", "no-build", "build-only", "down", "status")

/** Compose services for the names on the deploy line (flags skipped). */
fun Project.deployServices(): List<String> {
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
fun Project.deployPassthrough(): List<String> {
    val raw = (findProperty("passthrough") as String?) ?: ""
    return raw.split(Regex("\\s+")).map { it.trim() }.filter { it.isNotEmpty() }
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

fun Project.deployValidate() {
    deployConflicts().firstOrNull { (left, right, _) -> deployHas(left) && deployHas(right) }
        ?.let { (_, _, message) -> error(message) }
    if (deployHas("down") && deployServices().isNotEmpty()) {
        error("--down stops the whole stack; omit app names.")
    }
}

/** Start and wait for a process; 1 + "timed out" when it outlives the limit. */
fun startAndWait(builder: ProcessBuilder, timeoutSeconds: Long): Pair<Process?, Pair<Int, String>?> = try {
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

/**
 * Stream child output through println. inheritIO() attaches to the Gradle
 * daemon, not the terminal that ran deploy.py, so compose looked frozen.
 */
fun runInherited(builder: ProcessBuilder, timeoutSeconds: Long): Pair<Int, String> {
    builder.redirectErrorStream(true)
    val process = try {
        builder.start()
    } catch (error: java.io.IOException) {
        return 1 to error.message.orEmpty()
    }
    process.inputStream.bufferedReader().useLines { lines ->
        lines.forEach { line ->
            println(line)
            System.out.flush()
        }
    }
    if (timeoutSeconds > 0 && process.isAlive) {
        process.destroyForcibly()
        return 1 to "timed out"
    }
    return process.waitFor() to ""
}

/** Captured-output run: waits, reads everything, reports the exit code. */
fun runCaptured(builder: ProcessBuilder, timeoutSeconds: Long): Pair<Int, String> {
    builder.redirectErrorStream(true)
    val (process, failure) = startAndWait(builder, timeoutSeconds)
    if (failure != null) return failure
    val output = process!!.inputStream.bufferedReader().readText()
    return process.waitFor() to output
}

fun Project.runProcess(
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
fun Project.gatewayEnv(): Map<String, String> {
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

fun splitHosts(raw: String): List<String> = raw.replace(",", " ").split(Regex("\\s+")).filter { it.isNotEmpty() }

/** Values for the @@TOKEN@@ placeholders in the gateway template. */
fun Project.gatewayTokens(hosts: List<String>): Map<String, String> {
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
fun renderLines(template: String, values: Map<String, String>): List<String> = template.split("\n").mapNotNull { line ->
    val value = tokenName(line)?.let { values[it] } ?: return@mapNotNull line
    value.takeIf { it.isNotEmpty() }
}

/** Render deploy/nginx/default.conf from its template (idempotent). */
fun Project.renderGateway() {
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

fun Project.findOpenssl(): String {
    if (runProcess(listOf("openssl", "version")).first == 0) return "openssl"
    val bundled = listOf(
        "C:/Program Files/Git/usr/bin/openssl.exe",
        "C:/Program Files (x86)/Git/usr/bin/openssl.exe",
    )
    return bundled.firstOrNull { file(it).exists() }
        ?: error("openssl not found. Install Git for Windows (bundles openssl) or OpenSSL, then retry.")
}

fun Project.opensslRun(openssl: String, args: List<String>) {
    val (code, output) = runProcess(listOf(openssl) + args)
    if (code != 0) error("openssl ${args.first()} failed: ${output.trim()}")
}

fun sanEntry(host: String): String =
    if (host.matches(Regex("\\d+\\.\\d+\\.\\d+\\.\\d+")) || host.contains(":")) "IP:$host" else "DNS:$host"

fun sha256(path: java.io.File): String? = if (!path.exists()) {
    null
} else {
    java.security.MessageDigest.getInstance("SHA-256").digest(path.readBytes())
        .joinToString("") { "%02x".format(it) }
}

fun Project.leafCovers(openssl: String, hosts: List<String>, leafCrt: java.io.File, leafKey: java.io.File): Boolean {
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
    val covered = hosts.all { host ->
        val entry = sanEntry(host)
        val name = entry.substringAfter(":").lowercase()
        val want = if (entry.startsWith("IP:")) "ip address:$name" else "dns:$name"
        want in have
    }
    return covered && pairMatches(openssl, leafCrt, leafKey)
}

/** Write the CSR and SAN extension file for a leaf cert; returns their paths. */
fun Project.writeLeafRequest(
    openssl: String,
    hosts: List<String>,
    leafKey: java.io.File,
): Pair<java.io.File, java.io.File> {
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

/** Private keys are owner-read/write on POSIX. Windows has no POSIX view. */
fun ownerOnly(path: java.io.File) {
    val posix = java.nio.file.attribute.PosixFileAttributeView::class.java
    val view = java.nio.file.Files.getFileAttributeView(path.toPath(), posix) ?: return
    val mode = java.nio.file.attribute.PosixFilePermissions.fromString("rw-------")
    view.setPermissions(mode)
}

/** Delete a leftover key/cert file, or fail. A silent miss would be copied into the image. */
fun removeFile(path: java.io.File) {
    if (path.exists() && !path.delete()) {
        error("could not remove leftover ${path.name}")
    }
}

/** Drop install leftovers so the gateway image cannot bake a previous private key. */
fun sweepCertLeftovers(dir: java.io.File) {
    val names = listOf(
        "leaf.key.bak",
        "leaf.crt.bak",
        "leaf.key.work",
        "leaf.crt.work",
        "leaf.key.installing",
        "leaf.crt.installing",
    )
    names.forEach { name -> removeFile(java.io.File(dir, name)) }
}

/** Same-directory rename. Puts dest back if the new file cannot take its place. */
fun replaceFile(source: java.io.File, dest: java.io.File) {
    val backup = java.io.File(dest.parentFile, dest.name + ".bak")
    removeFile(backup)
    if (dest.exists() && !dest.renameTo(backup)) {
        error("could not move ${dest.name} aside")
    }
    if (!source.renameTo(dest)) {
        if (backup.exists()) backup.renameTo(dest)
        error("could not install ${dest.name}")
    }
    removeFile(backup)
}

/** Install a signed pair. copyTo would make the key world-readable on Linux. */
fun installLeafPair(crtOut: java.io.File, keyOut: java.io.File, certs: GatewayCerts) {
    val crtNew = java.io.File(certs.dir, "leaf.crt.installing")
    val keyNew = java.io.File(certs.dir, "leaf.key.installing")
    crtOut.copyTo(crtNew, overwrite = true)
    keyOut.copyTo(keyNew, overwrite = true)
    ownerOnly(keyNew)
    replaceFile(crtNew, certs.leafCrt)
    replaceFile(keyNew, certs.leafKey)
    ownerOnly(certs.leafKey)
}

/** openssl modulus line, or null when the file is not a cert/key of that kind. */
fun Project.modulusOf(openssl: String, args: List<String>): String? {
    val (code, output) = runProcess(listOf(openssl) + args)
    return if (code == 0) output.lineSequence().firstOrNull { it.startsWith("Modulus=") } else null
}

/** True when the leaf cert and key are a pair. A failed mint must not leave them split. */
fun Project.pairMatches(openssl: String, cert: java.io.File, key: java.io.File): Boolean {
    val certMod = modulusOf(openssl, listOf("x509", "-noout", "-modulus", "-in", cert.absolutePath))
    val keyMod = modulusOf(openssl, listOf("rsa", "-noout", "-modulus", "-in", key.absolutePath))
    return certMod != null && certMod == keyMod
}

fun Project.mintLeaf(openssl: String, hosts: List<String>, certs: GatewayCerts) {
    // Work files sit next to the live pair, not in the system temp directory.
    certs.dir.mkdirs()
    val keyOut = java.io.File(certs.dir, "leaf.key.work")
    val crtOut = java.io.File(certs.dir, "leaf.crt.work")
    keyOut.delete()
    crtOut.delete()
    try {
        val (csr, ext) = writeLeafRequest(openssl, hosts, keyOut)
        ownerOnly(keyOut)
        try {
            opensslRun(
                openssl,
                listOf(
                    "x509", "-req", "-in", csr.absolutePath,
                    "-CA", certs.caCrt.absolutePath, "-CAkey", certs.caKey.absolutePath, "-CAcreateserial",
                    "-out", crtOut.absolutePath, "-days", "825", "-extfile", ext.absolutePath,
                ),
            )
            installLeafPair(crtOut, keyOut, certs)
        } finally {
            csr.delete()
            ext.delete()
        }
    } finally {
        keyOut.delete()
        crtOut.delete()
    }
}

/** Copy TLS_CERT_FILE/TLS_KEY_FILE over the leaf; returns true when changed. */
fun Project.installProvidedCert(
    providedCert: String,
    providedKey: String,
    certs: GatewayCerts,
    hosts: List<String>,
): Boolean {
    if (providedCert.isEmpty() || providedKey.isEmpty()) {
        error("set both TLS_CERT_FILE and TLS_KEY_FILE, or neither (local-CA flow)")
    }
    val unchanged = sha256(certs.leafCrt) != null && sha256(certs.leafKey) != null &&
        sha256(certs.leafCrt) == sha256(file(providedCert)) && sha256(certs.leafKey) == sha256(file(providedKey))
    if (unchanged) {
        println("==> provided TLS cert already installed for: ${hosts.joinToString(", ")}")
        return false
    }
    installLeafPair(file(providedCert), file(providedKey), certs)
    println("==> installed provided TLS cert for: ${hosts.joinToString(", ")}")
    return true
}

/** Mint the local CA when missing; returns true when it was created. */
fun Project.ensureLocalCa(openssl: String, caKey: java.io.File, caCrt: java.io.File): Boolean {
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
    ownerOnly(caKey)
    return true
}

/** Mint the leaf with the local CA; returns true when it was re-minted. */
fun Project.mintLocalLeaf(env: Map<String, String>, hosts: List<String>, certs: GatewayCerts): Boolean {
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
fun Project.ensureGatewayCerts(): Boolean {
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

/** Render the gateway and refresh certs; warns when a rebuild would pick them up. */
fun Project.prepareGateway(services: List<String>) {
    renderGateway()
    // The gateway image copies this directory. Leftovers must not survive a matched pair.
    sweepCertLeftovers(file("deploy/gateway/certs"))
    if (deployHas("down") || deployHas("status")) return
    val hosts = splitHosts(gatewayEnv()["TLS_HOSTS"] ?: "")
    if (hosts.isEmpty()) return
    val changed = ensureGatewayCerts()
    val gatewayStale = deployHas("no-build") || (services.isNotEmpty() && "gateway" !in services)
    if (changed && gatewayStale) {
        println("==> certs changed: rebuild the gateway (include it in this deploy) to pick them up")
    }
}
