package workbench

import org.gradle.api.Project

/*
 * App catalog and -Papps selection for the root build: the npm workspaces and
 * compose services per app, and the id/alias/folder resolution shared by
 * buildNode, buildJvm, and `gradle deploy`. Extracted from the root
 * build.gradle.kts unchanged; `Project` extensions stand in for the script's
 * implicit receiver so call sites stay identical.
 */

/**
 * Per-app host build: npm workspaces in dependency order, the compose
 * services they produce, the Vite `APP_BASE_PATH` (empty = served at root),
 * `@stock-game/app` is reached through
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
    "radio-api" to HostApp(listOf("radio-api"), listOf("radio-api")),
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
    "apps/radio-station/api" to "radio-api",
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
fun exactAppMatch(key: String): String? = appMappings.keys.firstOrNull { it == key }
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
