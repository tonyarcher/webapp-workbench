package workbench

import org.gradle.api.Project

/*
 * App selection for `-Papps`: id/alias/folder resolution shared by buildNode,
 * buildJvm, and `gradle deploy`. The catalog itself lives in `apps.json`
 * (see AppCatalog.kt); this file is logic only. `Project` extensions stand in
 * for the script's implicit receiver so call sites stay identical.
 */

/** npm workspace -> repo-relative directory, for `-Papps=apps/rss` folder forms. */
@Suppress("UNCHECKED_CAST")
fun packageJson(path: java.io.File): Map<String, Any?>? = groovy.json.JsonSlurper().parse(path) as? Map<String, Any?>

// Scanned once per build and cached per project, matching the root script's
// one eager `val workspaceDirs = ...`.
private val workspaceDirCache: MutableMap<Project, Map<String, String>> =
    java.util.Collections.synchronizedMap(java.util.WeakHashMap())

val Project.workspaceDirs: Map<String, String>
    get() = workspaceDirCache.getOrPut(this) {
        fileTree(rootDir) {
            include("apps/**/package.json", "packages/**/package.json")
            exclude("**/node_modules/**")
        }.files.mapNotNull { packageFile ->
            val name = packageJson(packageFile)?.get("name") as? String
            val dir = packageFile.parentFile.relativeTo(rootDir).invariantSeparatorsPath
            name?.let { it to dir }
        }.toMap()
    }

// -Papps=<names...> (comma/space separated). Empty means every app.
val Project.appFilter: List<String>
    get() = (findProperty("apps") as String?)
        ?.split(',', ' ')
        ?.map { it.trim() }
        ?.filter { it.isNotEmpty() }
        ?: emptyList()

/** Plain app ids, aliases, and Docker-only names matching `key`, if any. */
fun Project.exactAppMatch(key: String): String? = appMappings.keys.firstOrNull { it == key }
    ?: appAliases[key]
    ?: dockerOnlyApps.firstOrNull { it == key }

/** Apps whose aliases or workspace dirs live under a folder prefix. */
fun Project.folderMatches(key: String): List<String> {
    fun under(value: String, prefix: String) = value == prefix || value.startsWith("$prefix/")
    return appMappings.keys.filter { app ->
        appAliases.filterValues { it == app }.keys.any { under(it, key) } ||
            appMappings.getValue(app).workspaces.any { workspace ->
                workspaceDirs[workspace]?.let { under(it, key) } == true
            }
    }
}

/** Resolve one name to app ids (id, alias, folder prefix, or Docker-only app). */
fun Project.resolveAppName(name: String): List<String> {
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
fun Project.filteredApps(): List<String> {
    if (appFilter.isEmpty()) return emptyList()
    return appFilter.flatMap { resolveAppName(it) }
        .filter { it in appMappings }
        .distinct()
}

/** Apps to build: `-Papps` filtered, or every app in build order. */
fun Project.selectedApps(): List<String> =
    if (appFilter.isEmpty()) buildOrder else buildOrder.filter { it in filteredApps() }

/** npm workspaces for the selected apps (APIs excluded; buildJvm owns them). */
fun Project.selectedJsWorkspaces(): List<String> =
    selectedApps().flatMap { appMappings.getValue(it).workspaces }.distinct()

fun Project.filteredServices(): List<String> = selectedApps().flatMap { appMappings.getValue(it).services }.distinct()

/** The `build` script of an npm workspace, or null when it has none. */
fun Project.packageJsonBuild(workspace: String): String? {
    val dir = workspaceDirs[workspace] ?: return null
    val scripts = packageJson(file("$dir/package.json"))?.get("scripts") as? Map<*, *>
    return scripts?.get("build") as? String
}
