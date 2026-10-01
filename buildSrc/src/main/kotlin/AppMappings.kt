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

/**
 * The workspace roots, read from the root package.json globs rather than listed
 * here.
 *
 * This used to hardcode the apps and packages globs, which meant a workspace
 * moved anywhere else was invisible to Gradle with no error: `-Papps=<app>` still
 * resolved, because resolveAppName only fails when an app matches nothing, so the
 * task graph just quietly stopped building that workspace. Deriving the roots
 * from the same globs npm uses means the two cannot drift, and a new root is
 * picked up by declaring it in package.json.
 *
 * Kotlin block comments nest, so a glob written inside one of these comments
 * would open another comment and swallow the rest of the file. They are written
 * out in prose above for that reason.
 */
private val WORKSPACE_ROOTS = listOf("apps/**", "libs/**")

val Project.workspaceDirs: Map<String, String>
    get() = workspaceDirCache.getOrPut(this) {
        fileTree(rootDir) {
            WORKSPACE_ROOTS.forEach { include("$it/package.json") }
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
fun Project.selectedJsWorkspaces(): List<String> = selectedApps().flatMap { jsWorkspacesOf(it) }.distinct()

/**
 * True when an npm workspace is a Kotlin API module rather than a JavaScript one.
 *
 * Structural: the API workspaces are the ones Gradle builds, and each carries a
 * build.gradle.kts. This used to be inferred from the workspace's npm `build`
 * script containing "gradle", which quietly coupled the task graph to those
 * shims existing; buildJvm builds the boot jars, so they no longer do.
 */
fun Project.isGradleWorkspace(workspace: String): Boolean {
    val dir = workspaceDirs[workspace] ?: return false
    return file("$dir/build.gradle.kts").exists()
}

/** The JavaScript workspaces of one app, in build order. */
fun Project.jsWorkspacesOf(app: String): List<String> =
    appMappings.getValue(app).workspaces.filterNot { isGradleWorkspace(it) }

fun Project.filteredServices(): List<String> = selectedApps().flatMap { appMappings.getValue(it).services }.distinct()

/** The `build` script body of an npm workspace, or null when it has none. */
fun Project.packageJsonBuild(workspace: String): String? {
    val dir = workspaceDirs[workspace] ?: return null
    val scripts = packageJson(file("$dir/package.json"))?.get("scripts") as? Map<*, *>
    return scripts?.get("build") as? String
}

/**
 * True when an npm workspace declares a `build` script.
 *
 * The Gradle task graph needs presence, not the script body: a library with no
 * build step must not be handed to `npm run build`, which exits 1 with "Missing
 * script". Naming the script it would run is the job of [packageJsonBuild]'s
 * caller, not this predicate.
 */
fun Project.hasBuildScript(workspace: String): Boolean = packageJsonBuild(workspace) != null
