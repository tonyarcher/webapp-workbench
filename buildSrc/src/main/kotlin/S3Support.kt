package workbench

import org.gradle.api.Project

/*
 * Optional S3 publish for every static app's assets, endpoint-based so one
 * seed (endpoint, bucket, region, credentials) works against SeaweedFS locally
 * and any S3-compatible cloud. Off by default: no S3_BUCKET means the
 * same-origin nginx deploy, exactly as today. When a bucket is set,
 * `gradle deploy` mirrors each static app's dist/ into the bucket (`--delete`
 * keeps it a mirror) over the S3 protocol, renders each app's runtime config
 * block with its own API origin, uploads that rendered document over the raw
 * index.html, and the gateway's asset-origin server block (built from the same
 * seed by assetServerBlock) fronts the store for each app's document and
 * assets. The static layer stays pure: the API lives on its own origin with
 * CORS, the client resolves its API base at runtime from the rendered block,
 * so a built dist/ is host-independent and one seed works locally or in any
 * cloud (a plain CDN or the raw endpoint fronts the store, never the API).
 *
 * Requires the AWS CLI on PATH and credentials in the standard AWS
 * env/profile. Runs only when S3_BUCKET is set, so a local deploy with no
 * credentials never touches this path.
 */

/** The object store's compose service name the gateway proxies the assets location to. */
const val STORE_UPSTREAM: String = "http://seaweedfs:8333"

/** The S3/asset-origin seed values threaded through the deploy task to compose. */
val S3_SEED_KEYS: List<String> = listOf(
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_PREFIX",
    "S3_REGION",
    "ASSETS_HOST",
    "PUBLIC_API_BASE",
    "STOCK_GAME_API_BASE",
    "FITNESS_API_BASE",
    "RADIO_API_BASE",
)

/** S3 key prefix: S3_PREFIX + the app base path, slashes trimmed. */
fun s3KeyPrefix(prefix: String, basePath: String): String {
    val parts = listOf(prefix, basePath).map { it.trim('/') }.filter { it.isNotEmpty() }
    return parts.joinToString("/")
}

/**
 * `aws s3 sync` that mirrors a dist/ directory into the bucket. `--endpoint-url`
 * is added only when an endpoint is set (SeaweedFS / an S3-compatible cloud);
 * real AWS sends none.
 */
fun s3SyncCommand(bucket: String, key: String, distDir: String, endpoint: String = ""): List<String> {
    val command = mutableListOf("aws", "s3", "sync", distDir, "s3://${bucket.trimEnd('/')}/$key", "--delete")
    if (endpoint.isNotBlank()) {
        command.add("--endpoint-url")
        command.add(endpoint.trim())
    }
    return command
}

/** The store's object path for an app's assets: bucket + key, no trailing slash. */
fun s3StorePath(bucket: String, prefix: String, basePath: String): String =
    listOf(bucket, s3KeyPrefix(prefix, basePath)).map { it.trim('/') }.filter { it.isNotEmpty() }.joinToString("/")

/** The publish tool present on PATH: the AWS CLI, the `mc` S3 client, or neither. */
enum class PublishTool { AWS, MC, NONE }

/** First publish tool found on PATH. Takes PATH and the OS name so it is testable. */
fun publishTool(pathEnv: String?, osName: String): PublishTool {
    val exe = if (osName.lowercase().contains("windows")) ".exe" else ""
    val dirs = pathEnv.orEmpty().split(java.io.File.pathSeparator).filter { it.isNotEmpty() }
    fun onPath(tool: String): Boolean = dirs.any { java.io.File(it, "$tool$exe").isFile }
    return when {
        onPath("aws") -> PublishTool.AWS
        onPath("mc") -> PublishTool.MC
        else -> PublishTool.NONE
    }
}

/** `mc mirror` equivalent of `aws s3 sync --delete` for a dist/ directory. */
fun mcMirrorCommand(alias: String, bucket: String, key: String, distDir: String): List<String> =
    listOf("mc", "mirror", "--overwrite", "--remove", distDir, "$alias/${bucket.trimEnd('/')}/$key")

/**
 * `mc` reads the store from `MC_HOST_<alias>` (`scheme://key:secret@host`), so
 * the credentials travel in the child environment instead of argv, where `ps`
 * on a shared box could read them.
 */
fun mcHostEnv(alias: String, endpoint: String, accessKey: String, secretKey: String): Map<String, String> {
    val trimmed = endpoint.trim().trimEnd('/')
    val scheme = if (trimmed.startsWith("http://")) "http" else "https"
    val host = trimmed.removePrefix("http://").removePrefix("https://")
    return mapOf("MC_HOST_$alias" to "$scheme://$accessKey:$secretKey@$host")
}

/** The store credentials: S3_ACCESS_KEY/S3_SECRET_KEY. */
private fun storeCredentials(env: Map<String, String>): Pair<String, String> {
    val access = env["S3_ACCESS_KEY"]?.trim().orEmpty()
    val secret = env["S3_SECRET_KEY"]?.trim().orEmpty()
    return access to secret
}

/** The alias `mc` is given the store under; the name is local to one publish run. */
private const val MC_ALIAS: String = "workbench"

/** `aws s3 mb` that creates the bucket, adding `--endpoint-url` only when set. */
fun s3MakeBucketCommand(bucket: String, endpoint: String = ""): List<String> {
    val command = mutableListOf("aws", "s3", "mb", "s3://${bucket.trimEnd('/')}")
    if (endpoint.isNotBlank()) {
        command.add("--endpoint-url")
        command.add(endpoint.trim())
    }
    return command
}

/** `mc mb --ignore-existing` that creates the bucket idempotently. */
fun mcMakeBucketCommand(alias: String, bucket: String): List<String> =
    listOf("mc", "mb", "--ignore-existing", "$alias/${bucket.trimEnd('/')}")

/** True when `aws s3 mb` failed only because the bucket already belongs to us. */
fun alreadyOwnsBucket(output: String): Boolean =
    output.contains("BucketAlreadyOwnedByYou") || output.contains("BucketAlreadyExists")

/**
 * Create the store bucket, then mirror an app's dist/ into it, gated on
 * S3_BUCKET. Before uploading, renders the document's `#app-config` block with
 * the app's API origin and uploads that rendered document over Vite's raw
 * index.html (which ships the same-origin `""` default), so the built dist/
 * stays host-independent. Prefers the AWS CLI and falls back to the `mc` S3
 * client, so a host with either one can publish without the other. The bucket
 * is created here rather than by a compose seeder, so the publish and the
 * store stay on the same credentials and there is no second image to keep in
 * sync.
 */
fun Project.publishAppAssets(env: Map<String, String>, app: S3App) {
    val bucket = env["S3_BUCKET"]?.trim().orEmpty()
    if (bucket.isEmpty()) {
        println("==> S3 publish skipped (S3_BUCKET not set)")
        return
    }
    val key = s3KeyPrefix(env["S3_PREFIX"].orEmpty(), app.basePath)
    val endpoint = env["S3_ENDPOINT"]?.trim().orEmpty()
    val rendered = renderAppConfig(file("${app.distDir}/index.html").readText(), app.apiBase, app.identityBase)
    val renderedFile = java.io.File.createTempFile("app-config-", ".html").also { it.writeText(rendered) }
    try {
        when (publishTool(System.getenv("PATH"), System.getProperty("os.name"))) {
            PublishTool.AWS -> {
                // `aws s3 mb` is not idempotent: an existing bucket is "already
                // owned", not an error worth failing the publish over.
                val (mbCode, mbOut) = runProcess(s3MakeBucketCommand(bucket, endpoint))
                if (mbCode != 0 && !alreadyOwnsBucket(mbOut)) {
                    error("S3 bucket create failed: ${mbOut.trim()}")
                }
                val (code, out) = runProcess(s3SyncCommand(bucket, key, app.distDir, endpoint))
                if (code != 0) error("S3 publish failed: ${out.trim()}")
                val (cpCode, cpOut) = runProcess(s3CopyCommand(bucket, key, renderedFile.absolutePath, endpoint))
                if (cpCode != 0) error("S3 document publish failed: ${cpOut.trim()}")
            }

            PublishTool.MC -> {
                val (access, secret) = storeCredentials(env)
                if (endpoint.isEmpty() || access.isEmpty() || secret.isEmpty()) {
                    error("mc publish needs S3_ENDPOINT plus S3_ACCESS_KEY/S3_SECRET_KEY")
                }
                val hostEnv = mcHostEnv(MC_ALIAS, endpoint, access, secret)
                val (mbCode, mbOut) = runProcess(mcMakeBucketCommand(MC_ALIAS, bucket), env = hostEnv)
                if (mbCode != 0) error("S3 bucket create failed: ${mbOut.trim()}")
                val (code, out) = runProcess(mcMirrorCommand(MC_ALIAS, bucket, key, app.distDir), env = hostEnv)
                if (code != 0) error("S3 publish failed: ${out.trim()}")
                val (cpCode, cpOut) = runProcess(
                    mcCopyCommand(MC_ALIAS, bucket, key, renderedFile.absolutePath),
                    env = hostEnv,
                )
                if (cpCode != 0) error("S3 document publish failed: ${cpOut.trim()}")
            }

            PublishTool.NONE ->
                error("no S3 publish tool on PATH: install the AWS CLI (`aws`) or the `mc` S3 client")
        }
    } finally {
        renderedFile.delete()
    }
    val via = if (endpoint.isEmpty()) "" else " (endpoint $endpoint)"
    println("==> published ${app.distDir} -> s3://$bucket/$key$via")
}

/**
 * Static apps the S3 asset origin does not serve, even though they ship a
 * dist/. `football` has in-flight uncommitted work on this branch and stays
 * out until that lands. `user-web` is the identity landing page: its session
 * is a SameSite=Lax cookie and every API call is origin-absolute `/user-api/`,
 * so serving it from a separate browser origin breaks sign-in — it stays
 * same-origin. `calendar-sync` depends on its own nginx proxy for `/api/trakt/`
 * (Trakt has no CORS), and that proxy does not exist on the asset origin, so
 * the app stays same-origin.
 */
private val S3_EXCLUDED_APPS: Set<String> = setOf("football", "user-web", "calendar-sync")

/**
 * The env key holding an app's cross-origin API origin, or null when it has
 * none (a client-only app). Each API-backed app names its own origin so the
 * rendered config block and the emitted `connect-src` are both accurate.
 */
internal fun apiBaseEnvKey(appId: String): String? = when (appId) {
    "rss-reader" -> "PUBLIC_API_BASE"
    "stock-game" -> "STOCK_GAME_API_BASE"
    "fitness" -> "FITNESS_API_BASE"
    "radio-station" -> "RADIO_API_BASE"
    else -> null
}

/**
 * The env key holding an app's cross-origin identity origin, or null when the
 * app never authenticates. It is `OAUTH_PUBLIC_BASE` — the browser-facing
 * `/user-api` on the gateway — and an asset-origin app must be told it
 * explicitly: the client otherwise resolves the identity base from
 * `location.origin`, which on the asset origin is an origin where no identity
 * service runs, so sign-in and token refresh would fail. Only the apps whose
 * client actually carries the OAuth flow name it, so the CSP does not widen
 * `connect-src` for an app that never calls the identity service.
 */
internal fun identityBaseEnvKey(appId: String): String? = when (appId) {
    "rss-reader", "stock-game" -> "OAUTH_PUBLIC_BASE"
    else -> null
}

/** The app's built dist/ directory, from its last JavaScript workspace. */
private fun Project.staticDistDir(appId: String): String? {
    val workspaces = jsWorkspacesOf(appId)
    val last = workspaces.lastOrNull() ?: return null
    val dir = workspaceDirs[last] ?: return null
    return "$dir/dist"
}

/**
 * Expand `${NAME}` references in a seed value against the same env map, the way
 * compose expands `deploy/.env` at run time. `dotenvLine` does not expand, so a
 * value written as `${PUBLIC_ORIGIN}/user-api` would otherwise reach the client
 * as that literal string.
 *
 * Applied only to the origins that are rendered into the client config, not to
 * every `deploy/.env` value: a password or secret containing `${...}` must stay
 * exactly as written.
 */
internal fun expandEnv(value: String, env: Map<String, String>): String =
    Regex("""\$\{([A-Za-z_][A-Za-z0-9_]*)\}""").replace(value) { match ->
        env[match.groupValues[1]]?.trim().orEmpty().ifEmpty { match.value }
    }

/**
 * The static apps the deploy can publish and serve: every app in the catalog
 * with a non-empty base path and a JavaScript workspace, minus the exclusions.
 * The JVM APIs carry no base path and no dist/ and so drop out here; the
 * Docker-only services are not in the catalog at all.
 */
fun Project.s3Apps(env: Map<String, String>): List<S3App> = buildList {
    for ((id, app) in appMappings) {
        if (app.basePath.isEmpty() || id in S3_EXCLUDED_APPS) continue
        val distDir = staticDistDir(id) ?: continue
        val pwa = S3_PWA_FILES[id] ?: PwaFiles(null, false, emptyList())
        val apiBase = apiBaseEnvKey(id)?.let { expandEnv(env[it].orEmpty(), env).trim() }.orEmpty()
        val identityBase = identityBaseEnvKey(id)?.let { expandEnv(env[it].orEmpty(), env).trim() }.orEmpty()
        add(S3App(id, app.basePath, distDir, apiBase, identityBase, pwa.manifest, pwa.swJs, pwa.icons))
    }
}

/**
 * One proxying `location` block: the match pattern, the upstream, the rewrite
 * that maps the public path onto it, and any `add_header` lines.
 */
private fun proxyLocation(
    match: String,
    varName: String,
    upstream: String,
    rewrite: String,
    headers: List<String>,
): List<String> = buildList {
    add("    location $match {")
    add("        set \$$varName $upstream;")
    add("        rewrite $rewrite break;")
    add("        proxy_pass \$$varName;")
    add("        proxy_http_version 1.1;")
    add("        proxy_set_header Host \$host;")
    add("        proxy_set_header X-Real-IP \$remote_addr;")
    add("        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;")
    add("        proxy_set_header X-Forwarded-Proto \$scheme;")
    add("        proxy_set_header X-Request-ID \$request_id;")
    headers.forEach { add("        $it") }
    add("    }")
}

/**
 * The asset-origin server block, or "" when ASSETS_HOST or S3_BUCKET is unset
 * so today's rendered config is unchanged. One gateway nginx container serves
 * both origins via `server_name`: this block is the asset origin, whose
 * document is the store's rendered `index.html` (the publish swaps the app's
 * API origin into its `#app-config` block). Each static app is served under its
 * own base path so Vite's base-relative output resolves unchanged: the hashed
 * assets under `/assets/`, the document, and the PWA files (`sw.js`, the web
 * manifest, the icons) all come from the object store. The document location
 * pins its origin policy per app (see [S3_CSP]): the fixed script/style/img
 * sources, widened where the app loads cross-origin fonts or scripts, plus its
 * connect-src/media-src — or no CSP at all where the app's reachable origins
 * cannot be stated accurately.
 */
fun assetServerBlock(apps: List<S3App>, env: Map<String, String>, tls: Boolean, redirect: Boolean): String {
    val host = env["ASSETS_HOST"]?.trim().orEmpty()
    val bucket = env["S3_BUCKET"]?.trim().orEmpty()
    // The asset origin needs a store to front. Without a bucket there is nothing
    // to serve, and a half-configured block would rewrite to the wrong key.
    if (host.isEmpty() || bucket.isEmpty()) return ""
    val lines = mutableListOf(
        "",
        "# Asset origin: every app's document and static assets on their own",
        "# browser origin (B1), fronted by this nginx with the object store behind",
        "# it. Each app is served under its base path so Vite's base-relative",
        "# output resolves, and every file routes to the store. Emitted only when",
        "# ASSETS_HOST and S3_BUCKET are both set.",
        "server {",
    )
    if (!redirect) lines.add("    listen 80;")
    if (tls) lines.add("    listen 443 ssl;")
    lines.add("    server_name $host;")
    lines.add("    server_tokens off;")
    lines.add("")
    lines.add("    access_log /dev/stdout app_json;")
    lines.add("    error_log /dev/stderr warn;")
    lines.add("")
    if (tls) {
        lines.add("    ssl_certificate /etc/nginx/certs/leaf.crt;")
        lines.add("    ssl_certificate_key /etc/nginx/certs/leaf.key;")
        lines.add("    ssl_protocols TLSv1.2 TLSv1.3;")
        lines.add("")
    }
    lines.add("    resolver 127.0.0.11 valid=30s ipv6=off;")

    appendAppLocations(lines, apps, env)
    lines.add("}")
    return lines.joinToString("\n")
}

/**
 * The per-app static locations for the gateway's own host, or "" when the store
 * is unset. Once the per-app UI containers are gone this is the only thing that
 * serves those apps, so an unset store is a deploy error rather than a fallback.
 */
internal fun appLocationsToken(apps: List<S3App>, env: Map<String, String>): String {
    if (env["S3_BUCKET"]?.trim().isNullOrEmpty()) return ""
    val lines = mutableListOf<String>()
    appendAppLocations(lines, apps, env)
    return lines.joinToString("\n")
}

/**
 * Append the per-app static location set: the base-path 301, the hashed assets,
 * the PWA files, and the document with its per-app CSP — all from the object
 * store. Shared by the asset-origin server block and the gateway's own subpath
 * locations, so both hosts serve an app identically from one definition.
 */
internal fun appendAppLocations(lines: MutableList<String>, apps: List<S3App>, env: Map<String, String>) {
    val bucket = env["S3_BUCKET"]?.trim().orEmpty()
    val prefix = env["S3_PREFIX"]?.trim().orEmpty()

    for (app in apps) {
        val basePath = app.basePath
        val storePath = s3StorePath(bucket, prefix, basePath)
        // One rewrite maps any public base-path onto the mirrored store key.
        val storeRewrite = "^$basePath(.*)\$ /$storePath/\$1"
        lines.add("")
        lines.add("    location = ${basePath.trimEnd('/')} {")
        lines.add("        return 301 $basePath\$is_args\$args;")
        lines.add("    }")
        lines.add("")
        lines.add("    # Hashed static assets: immutable cache, served from the object store.")
        lines.addAll(
            proxyLocation(
                match = "^~ ${basePath}assets/",
                varName = "upstream_store",
                upstream = STORE_UPSTREAM,
                rewrite = storeRewrite,
                headers = listOf(
                    "add_header Cache-Control \"public, max-age=31536000, immutable\";",
                    "add_header X-Content-Type-Options \"nosniff\" always;",
                ),
            ),
        )
        lines.add("")
        if (app.swJs) {
            lines.addAll(
                proxyLocation(
                    match = "= ${basePath}sw.js",
                    varName = "upstream_store",
                    upstream = STORE_UPSTREAM,
                    rewrite = storeRewrite,
                    headers = listOf("add_header Cache-Control \"no-cache\";"),
                ),
            )
        }
        if (app.manifest != null) {
            lines.addAll(
                proxyLocation(
                    match = "= ${basePath}${app.manifest}",
                    varName = "upstream_store",
                    upstream = STORE_UPSTREAM,
                    rewrite = storeRewrite,
                    headers = listOf("add_header Cache-Control \"no-cache\";"),
                ),
            )
        }
        if (app.icons.isNotEmpty()) {
            // Icon names carry dots, which the nginx regex must read as literal:
            // escape each before joining the alternation.
            val iconPattern = app.icons.joinToString("|") { it.replace(".", "\\.") }
            lines.addAll(
                proxyLocation(
                    match = "~ ^$basePath($iconPattern)\$",
                    varName = "upstream_store",
                    upstream = STORE_UPSTREAM,
                    rewrite = storeRewrite,
                    headers = listOf("add_header Cache-Control \"public, max-age=86400\";"),
                ),
            )
        }
        lines.add("")
        lines.add("    # The document is the store's rendered index.html (the publish swaps")
        lines.add("    # the app's API origin into its #app-config block): never cache it,")
        lines.add("    # and pin its origin policy per app (see S3_CSP): the fixed")
        lines.add("    # script/style/img sources widened where the app loads cross-origin")
        lines.add("    # fonts or scripts, plus the app's connect and media sources — or no")
        lines.add("    # CSP where the app's reachable origins cannot be stated accurately.")
        lines.add("    # Only the base path serves the document; there is no SPA fallback, so")
        lines.add("    # a hash-routed app works here and a history-routed app needs a")
        lines.add("    # fallback before it can move.")
        val headers = buildList {
            add("add_header Cache-Control \"no-cache\";")
            cspHeader(app)?.let { add("add_header Content-Security-Policy \"$it\" always;") }
            add("add_header X-Content-Type-Options \"nosniff\" always;")
            add("add_header X-Frame-Options \"SAMEORIGIN\" always;")
            add("add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;")
        }
        lines.addAll(
            proxyLocation(
                match = "= $basePath",
                varName = "upstream_store",
                upstream = STORE_UPSTREAM,
                rewrite = "^ /$storePath/index.html",
                headers = headers,
            ),
        )
    }
}
