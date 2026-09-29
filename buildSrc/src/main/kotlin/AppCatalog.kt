package workbench

import org.gradle.api.Project

/*
 * App catalog: the data a new app adds. `apps.json` at the repo root is the
 * single source of truth for app ids, npm workspaces, compose services,
 * aliases, boot jar paths, and the compose file. The selection logic in
 * AppMappings.kt and the deploy/compose drivers read it from here; adding an
 * app means editing `apps.json`, not Kotlin.
 */

data class HostApp(
    val workspaces: List<String>,
    val services: List<String>,
    val basePath: String = "",
    val buildScript: String = "build",
)

data class AppCatalog(
    val composeFile: String,
    val apiJars: Map<String, String>,
    val apps: Map<String, HostApp>,
    val buildOrder: List<String>,
    val aliases: Map<String, String>,
    val dockerOnlyApps: Set<String>,
)

/*
 * One cached catalog, paired with the mtime it was parsed from.
 *
 * Keying a map on Project alone is not enough, and the obvious "fix" of adding
 * the mtime to the key is worse: a key holding a strong Project reference
 * defeats the WeakHashMap and leaks an entry per build inside a long-lived
 * daemon. buildSrc's classes outlive a single build in a warm daemon, so the old
 * cache returned the catalog parsed by whichever build started it, and editing
 * apps.json did nothing at all -- no error, just the old app list, until the
 * daemon was stopped by hand. That contradicts the contract at the top of this
 * file, and silently, which is the worst way for it to fail.
 *
 * So: hold the last parse beside its mtime, and re-parse when the file changes.
 * The catalog is one small JSON read a handful of times per build, so the stat
 * per access is cheaper than a parse and the stale read is gone.
 */
private var cachedCatalog: Pair<Long, AppCatalog>? = null

private val appEntryKeys: Set<String> =
    setOf("id", "workspaces", "services", "basePath", "buildScript", "aliases")

val Project.appCatalog: AppCatalog
    get() {
        val modified = java.io.File(rootDir, "apps.json").lastModified()
        val cached = cachedCatalog
        if (cached != null && cached.first == modified) return cached.second
        val loaded = loadAppCatalog(rootDir)
        cachedCatalog = modified to loaded
        return loaded
    }

val Project.appMappings: Map<String, HostApp>
    get() = appCatalog.apps

val Project.buildOrder: List<String>
    get() = appCatalog.buildOrder

val Project.appAliases: Map<String, String>
    get() = appCatalog.aliases

val Project.dockerOnlyApps: Set<String>
    get() = appCatalog.dockerOnlyApps

private fun catalogObject(value: Any?, where: String): Map<String, Any?> {
    if (value is Map<*, *>) {
        val out = LinkedHashMap<String, Any?>()
        for ((key, entry) in value) {
            if (key !is String) error("$where: expected string keys")
            out[key] = entry
        }
        return out
    }
    error("$where: expected an object")
}

private fun catalogList(value: Any?, where: String): List<*> = (value as? List<*>) ?: error("$where: expected a list")

private fun catalogString(value: Any?, where: String): String =
    (value as? String)?.takeIf { it.isNotEmpty() } ?: error("$where: expected a non-empty string")

private fun catalogStringOr(value: Any?, where: String, default: String): String = when (value) {
    null -> default
    is String -> value
    else -> error("$where: expected a string")
}

private fun catalogStringList(value: Any?, where: String): List<String> {
    val list = catalogList(value, where)
    if (!list.all { it is String && it.isNotEmpty() }) {
        error("$where: expected a list of non-empty strings")
    }
    val strings = list.filterIsInstance<String>()
    if (strings.size != strings.toSet().size) error("$where: must not contain duplicates")
    return strings
}

private fun catalogStringMap(value: Any?, where: String): Map<String, String> {
    val map = catalogObject(value, where)
    for ((key, entry) in map) {
        if (entry !is String || entry.isEmpty()) error("$where.$key: expected a non-empty string")
    }
    @Suppress("UNCHECKED_CAST")
    return map as Map<String, String>
}

/** Parse `apps.json`; fail fast with the location so a bad catalog never builds half the tree. */
fun loadAppCatalog(rootDir: java.io.File): AppCatalog {
    val file = java.io.File(rootDir, "apps.json")
    if (!file.isFile) {
        error("missing app catalog: ${file.invariantSeparatorsPath} (add the new app there, not in Kotlin)")
    }
    val root = try {
        packageJson(file)
    } catch (error: Exception) {
        error("could not parse app catalog ${file.invariantSeparatorsPath}: ${error.message}")
    } ?: error("could not parse app catalog ${file.invariantSeparatorsPath}: expected an object")
    val composeFile = catalogString(root["composeFile"], "apps.json.composeFile")
    val apiJars = catalogStringMap(root["apiJars"], "apps.json.apiJars")
    if (apiJars.isEmpty()) error("apps.json.apiJars must not be empty")
    val rawApps = catalogList(root["apps"], "apps.json.apps")
    if (rawApps.isEmpty()) error("apps.json.apps must not be empty")
    val apps = LinkedHashMap<String, HostApp>()
    val aliases = LinkedHashMap<String, String>()
    rawApps.forEachIndexed { index, entry ->
        val where = "apps.json.apps[$index]"
        val obj = catalogObject(entry, where)
        val unknown = obj.keys - appEntryKeys
        if (unknown.isNotEmpty()) {
            error("$where: unknown keys ${unknown.sorted().joinToString(", ")}")
        }
        val id = catalogString(obj["id"], "$where.id")
        if (id in apps) error("$where: duplicate app id \"$id\"")
        val workspaces = catalogStringList(obj["workspaces"], "$where.workspaces")
        if (workspaces.isEmpty()) error("$where.workspaces must not be empty")
        val services = catalogStringList(obj["services"], "$where.services")
        if (services.isEmpty()) error("$where.services must not be empty")
        val basePath = catalogStringOr(obj["basePath"], "$where.basePath", "")
        val buildScript = catalogStringOr(obj["buildScript"], "$where.buildScript", "build")
        if (buildScript.isEmpty()) error("$where.buildScript must not be empty")
        val entryAliases = if (obj.containsKey("aliases")) {
            catalogStringList(obj["aliases"], "$where.aliases")
        } else {
            emptyList()
        }
        apps[id] = HostApp(workspaces, services, basePath, buildScript)
        entryAliases.forEach { alias ->
            val prev = aliases.putIfAbsent(alias, id)
            if (prev != null && prev != id) error("$where: duplicate alias \"$alias\" (already maps to \"$prev\")")
        }
    }
    val dockerOnly = catalogStringMap(root["dockerOnly"], "apps.json.dockerOnly")
    dockerOnly.forEach { (alias, service) ->
        val prev = aliases.putIfAbsent(alias, service)
        if (prev != null && prev != service) {
            error("apps.json.dockerOnly: duplicate alias \"$alias\" (already maps to \"$prev\")")
        }
    }
    aliases.forEach { (alias, target) ->
        if (alias in apps) error("apps.json: alias \"$alias\" shadows an app id")
        if (target !in apps && target !in dockerOnly.values) {
            error("apps.json: alias \"$alias\" points at unknown app \"$target\"")
        }
    }
    return AppCatalog(
        composeFile = composeFile,
        apiJars = apiJars,
        apps = apps,
        buildOrder = apps.keys.toList(),
        aliases = aliases,
        dockerOnlyApps = dockerOnly.values.toSet(),
    )
}
