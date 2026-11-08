package workbench

import org.gradle.api.Project

/*
 * Base-path checks for a built static app.
 *
 * Vite's default base is `/`, so a build that never received APP_BASE_PATH
 * writes `src="/assets/..."`. At `/baseball/` that asks the origin root for
 * the file, every request misses, and the app renders blank even though each
 * document request returns 200. The Gradle build passes APP_BASE_PATH per app;
 * these checks stop a dist/ left by a bare `npm run build` from being
 * published or baked into an image.
 */

/** Asset references in a built document, e.g. `src="./assets/index-a.js"`. */
private val BUILT_ASSET_REFERENCE: Regex = Regex("""(?:src|href)="([^"]*assets/[^"]*)"""")

/**
 * True when every asset reference in a built document resolves under
 * [basePath]. Relative references (`./assets/...`) pass because they resolve
 * against the document's own subpath, which is what the apps built with
 * `base: './'` ship. Absolute CDN references pass too: they are not served by
 * this origin.
 */
internal fun assetsFitBase(html: String, basePath: String): Boolean = BUILT_ASSET_REFERENCE.findAll(html).all { match ->
    val ref = match.groupValues[1]
    ref.startsWith("./") ||
        ref.startsWith(basePath) ||
        ref.startsWith("http://") ||
        ref.startsWith("https://")
}

/** Fail with the fix in the message rather than publish a document that cannot load. */
internal fun requireAssetsFitBase(id: String, basePath: String, html: String) {
    require(assetsFitBase(html, basePath)) {
        "$id: built index.html references assets outside $basePath, so the app would render " +
            "blank at $basePath. That happens when the dist/ came from a bare `npm run build`, " +
            "which bakes Vite's default `/` base. Rebuild it through Gradle: " +
            "`./gradlew buildNode -Papps=$id` (or `python build.py $id`)."
    }
}

/** The app's built dist/ directory, from its last JavaScript workspace. */
internal fun Project.staticDistDir(appId: String): String? {
    val workspaces = jsWorkspacesOf(appId)
    val last = workspaces.lastOrNull() ?: return null
    val dir = workspaceDirs[last] ?: return null
    return "$dir/dist"
}

/**
 * Check an app's built document before a publish or an image build bakes it
 * in. Skips apps the catalog gives no base path, no dist/ directory, or that
 * have never been built, so an API-only or fresh checkout is not failed for a
 * missing artifact.
 */
fun Project.requireBuiltAssetsFitBase(appId: String) {
    val entry = appMappings[appId] ?: return
    if (entry.basePath.isEmpty()) return
    val distDir = staticDistDir(appId) ?: return
    val index = file("$distDir/index.html")
    if (!index.isFile) return
    requireAssetsFitBase(appId, entry.basePath, index.readText())
}
