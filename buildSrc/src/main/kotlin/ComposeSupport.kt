package workbench

import org.gradle.api.Project

/*
 * Docker engine selection and compose invocation for `gradle deploy`, plus the
 * boot jar paths the API Dockerfiles copy. Extracted from the root
 * build.gradle.kts unchanged; `Project` extensions stand in for the script's
 * implicit receiver so call sites stay identical.
 */

/** Boot jar paths keyed by compose service (what the API Dockerfiles copy). */
class ApiJars(val paths: Map<String, String>)

val Project.apiJars: ApiJars
    get() = ApiJars(appCatalog.apiJars)

val Project.composeFile: String
    get() = appCatalog.composeFile

/** Parse a `tcp://host:port` Docker URL, or null. */
fun parseDockerHost(host: String): Pair<String, Int>? {
    val rest = host.removePrefix("tcp://")
    val parts = rest.split(":")
    val port = if (host.startsWith("tcp://") && parts.size == 2) parts[1].toIntOrNull() else null
    return if (port == null) null else parts[0] to port
}

/** Wanted engine from flags/DEPLOY_TARGET, validated. */
fun Project.wantedEngine(): String {
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
fun Project.dockerAnswers(host: String): Boolean {
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
fun Project.requireRemote(host: String): String {
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
fun Project.autoEngine(existing: String, tunnel: String): String = when {
    existing.isNotEmpty() && dockerAnswers(existing) -> existing

    dockerAnswers(tunnel) -> tunnel

    dockerAnswers("") -> ""

    else -> error(
        "No Docker engine is reachable. Start the SSH tunnel to the remote daemon " +
            "($tunnel) or start local Docker.",
    )
}

/** Engine pick: local/remote/DEPLOY_TARGET, DOCKER_HOST, tunnel, local. */
fun Project.resolveDockerHost(): String? {
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

fun Project.composeArgsFor(services: List<String>): List<String> {
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

/** `--progress` is global. `up --progress` is an unknown flag on Compose v5. */
fun Project.composeLine(compose: List<String>, args: List<String>): List<String> {
    val builds = args.firstOrNull() == "build" || "--build" in args
    val already = args.any { it == "--progress" || it.startsWith("--progress=") }
    val progress = if (builds && !already) listOf("--progress", "plain") else emptyList()
    return compose + progress + listOf("-f", composeFile) + args
}

fun Project.composeCommand(): List<String> {
    if (runProcess(listOf("docker", "compose", "version")).first == 0) {
        return listOf("docker", "compose")
    }
    if (runProcess(listOf("docker-compose", "version")).first == 0) {
        return listOf("docker-compose")
    }
    error("Neither `docker compose` nor `docker-compose` is available on PATH.")
}
