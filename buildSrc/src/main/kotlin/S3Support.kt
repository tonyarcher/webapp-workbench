package workbench

import org.gradle.api.Project

/*
 * Optional S3 publish for an app's static assets, endpoint-based so one seed
 * (endpoint, bucket, region, credentials) works against MinIO locally and any
 * S3-compatible cloud. Off by default: no S3_BUCKET means the same-origin
 * nginx deploy, exactly as today. When a bucket is set, `gradle deploy`
 * mirrors the app's dist/ into the bucket (`--delete` keeps it a mirror) over
 * the S3 protocol. The gateway's asset-origin server block (built from the
 * same seed by assetServerBlock) fronts the store for the assets location while the
 * JVM still renders the HTML shell and the client points back at the API
 * cross-origin (CORS).
 *
 * Requires the AWS CLI on PATH and credentials in the standard AWS
 * env/profile. Runs only when S3_BUCKET is set, so a local deploy with no
 * credentials never touches this path.
 */

/** The reader's base path: its S3 key suffix and gateway subpath. */
const val READER_BASE_PATH: String = "/rss-reader/"

/** The object store's compose service name the gateway proxies the assets location to. */
const val STORE_UPSTREAM: String = "http://minio:9000"

/** The S3/asset-origin seed values threaded through the deploy task to compose. */
val S3_SEED_KEYS: List<String> = listOf(
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_PREFIX",
    "S3_REGION",
    "ASSETS_HOST",
    "ASSETS_BASE",
    "PUBLIC_API_BASE",
)

/** S3 key prefix: S3_PREFIX + the app base path, slashes trimmed. */
fun s3KeyPrefix(prefix: String, basePath: String): String {
    val parts = listOf(prefix, basePath).map { it.trim('/') }.filter { it.isNotEmpty() }
    return parts.joinToString("/")
}

/**
 * `aws s3 sync` that mirrors a dist/ directory into the bucket. `--endpoint-url`
 * is added only when an endpoint is set (MinIO / an S3-compatible cloud); real
 * AWS sends none.
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

/** The publish tool present on PATH: the AWS CLI, MinIO's `mc`, or neither. */
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

/** The store credentials: S3_ACCESS_KEY/S3_SECRET_KEY, else the MinIO root pair. */
private fun storeCredentials(env: Map<String, String>): Pair<String, String> {
    val access = env["S3_ACCESS_KEY"]?.trim().orEmpty().ifEmpty { env["MINIO_ROOT_USER"]?.trim().orEmpty() }
    val secret = env["S3_SECRET_KEY"]?.trim().orEmpty().ifEmpty { env["MINIO_ROOT_PASSWORD"]?.trim().orEmpty() }
    return access to secret
}

/** The alias `mc` is given the store under; the name is local to one publish run. */
private const val MC_ALIAS: String = "workbench"

/**
 * Mirror an app's dist/ into S3, gated on S3_BUCKET. Prefers the AWS CLI and
 * falls back to MinIO's `mc`, so a host with either one can publish without the
 * other.
 */
fun Project.publishAppAssets(env: Map<String, String>, distDir: String, basePath: String) {
    val bucket = env["S3_BUCKET"]?.trim().orEmpty()
    if (bucket.isEmpty()) {
        println("==> S3 publish skipped (S3_BUCKET not set)")
        return
    }
    val key = s3KeyPrefix(env["S3_PREFIX"].orEmpty(), basePath)
    val endpoint = env["S3_ENDPOINT"]?.trim().orEmpty()
    val (code, out) = when (publishTool(System.getenv("PATH"), System.getProperty("os.name"))) {
        PublishTool.AWS -> runProcess(s3SyncCommand(bucket, key, distDir, endpoint))

        PublishTool.MC -> {
            val (access, secret) = storeCredentials(env)
            if (endpoint.isEmpty() || access.isEmpty() || secret.isEmpty()) {
                error("mc publish needs S3_ENDPOINT plus S3_ACCESS_KEY/S3_SECRET_KEY (or MINIO_ROOT_USER/PASSWORD)")
            }
            runProcess(
                mcMirrorCommand(MC_ALIAS, bucket, key, distDir),
                env = mcHostEnv(MC_ALIAS, endpoint, access, secret),
            )
        }

        PublishTool.NONE ->
            error("no S3 publish tool on PATH: install the AWS CLI (`aws`) or MinIO's client (`mc`)")
    }
    if (code != 0) error("S3 publish failed: ${out.trim()}")
    val via = if (endpoint.isEmpty()) "" else " (endpoint $endpoint)"
    println("==> published $distDir -> s3://$bucket/$key$via")
}

/** The hashed module entry (`assets/index-<hash>.js`) from a parsed Vite manifest. */
fun shellEntryFromManifest(manifest: Map<String, Any?>?): String {
    val entry = manifest?.get("index.html") as? Map<*, *> ?: return ""
    return entry["file"] as? String ?: ""
}

/** Resolve the hashed module entry from the Vite manifest, or "" when absent. */
fun Project.resolveShellEntry(distDir: String): String {
    val manifest = file("$distDir/.vite/manifest.json")
    if (!manifest.isFile) return ""
    return shellEntryFromManifest(packageJson(manifest))
}

/** The hashed CSS files (`assets/index-<hash>.css`) from a parsed Vite manifest. */
fun shellCssFromManifest(manifest: Map<String, Any?>?): List<String> {
    val entry = manifest?.get("index.html") as? Map<*, *> ?: return emptyList()
    val css = entry["css"] as? List<*> ?: return emptyList()
    return css.filterIsInstance<String>()
}

/** Resolve the hashed CSS files from the Vite manifest, or [] when absent. */
fun Project.resolveShellCss(distDir: String): List<String> {
    val manifest = file("$distDir/.vite/manifest.json")
    if (!manifest.isFile) return emptyList()
    return shellCssFromManifest(packageJson(manifest))
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
 * The reader's asset-origin server block, or "" when ASSETS_HOST is unset so
 * today's rendered config is unchanged. One gateway nginx container serves both
 * origins via `server_name`: this block is the asset origin, whose document is
 * the JVM shell. The app is served under its `/rss-reader/` base path so Vite's
 * `base: '/rss-reader/'` output resolves here unchanged: the hashed assets
 * under `/assets/` and the PWA files (`sw.js`, the web manifest, the icons)
 * come from the object store, while the document and every SPA route proxy to
 * `rss-api` `GET /app` with no-cache, plus a CSP pinning scripts and styles to
 * this origin and connects to the API origin.
 */
fun assetServerBlock(env: Map<String, String>, tls: Boolean, redirect: Boolean): String {
    val host = env["ASSETS_HOST"]?.trim().orEmpty()
    val bucket = env["S3_BUCKET"]?.trim().orEmpty()
    // The asset origin needs a store to front. Without a bucket there is nothing
    // to serve, and a half-configured block would rewrite to the wrong key.
    if (host.isEmpty() || bucket.isEmpty()) return ""
    val assetsBase = env["ASSETS_BASE"]?.trim().orEmpty()
    val apiBase = env["PUBLIC_API_BASE"]?.trim().orEmpty()
    val storePath = s3StorePath(bucket, env["S3_PREFIX"]?.trim().orEmpty(), READER_BASE_PATH)
    // One rewrite maps any public /rss-reader/ path onto the mirrored store key.
    val storeRewrite = "^$READER_BASE_PATH(.*)\$ /$storePath/\$1"
    val lines = mutableListOf(
        "",
        "# Asset origin: the reader's static assets on their own browser origin (B1),",
        "# fronted by this nginx with the object store behind it. The app is served",
        "# under its /rss-reader/ base path so Vite's base-relative output resolves,",
        "# and the PWA files route to the store rather than the shell. Emitted only",
        "# when ASSETS_HOST is set.",
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
    lines.add("")
    lines.add("    location = /rss-reader {")
    lines.add("        return 301 /rss-reader/\$is_args\$args;")
    lines.add("    }")
    lines.add("")
    lines.add("    # Hashed static assets: immutable cache, served from the object store.")
    lines.addAll(
        proxyLocation(
            match = "^~ /rss-reader/assets/",
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
    lines.add("    # PWA files. The service worker must revalidate (a stale sw.js pins a")
    lines.add("    # stale precache); the web manifest and icons may cache briefly. All")
    lines.add("    # three must come from the store: proxying them to the shell would")
    lines.add("    # return text/html and the service worker would refuse to install.")
    lines.addAll(
        proxyLocation(
            match = "= /rss-reader/sw.js",
            varName = "upstream_store",
            upstream = STORE_UPSTREAM,
            rewrite = storeRewrite,
            headers = listOf("add_header Cache-Control \"no-cache\";"),
        ),
    )
    lines.addAll(
        proxyLocation(
            match = "= /rss-reader/manifest.webmanifest",
            varName = "upstream_store",
            upstream = STORE_UPSTREAM,
            rewrite = storeRewrite,
            headers = listOf("add_header Cache-Control \"no-cache\";"),
        ),
    )
    lines.addAll(
        proxyLocation(
            match = "~ ^/rss-reader/(favicon\\.svg|icon-192\\.png|icon-512\\.png)\$",
            varName = "upstream_store",
            upstream = STORE_UPSTREAM,
            rewrite = storeRewrite,
            headers = listOf("add_header Cache-Control \"public, max-age=86400\";"),
        ),
    )
    lines.add("")
    lines.add("    # The document and every SPA route are the SSR shell (GET /app): never")
    lines.add("    # cache it, and pin its origin policy to this origin (scripts, styles)")
    lines.add("    # and the API origin (connect).")
    lines.addAll(
        proxyLocation(
            match = "/rss-reader/",
            varName = "upstream_shell",
            upstream = "http://rss-api:3000",
            rewrite = "^ /app",
            headers = listOf(
                "add_header Cache-Control \"no-cache\";",
                "add_header Content-Security-Policy \"default-src 'self'; script-src 'self' $assetsBase; " +
                    "style-src 'self' $assetsBase; connect-src $apiBase; img-src 'self' data: https:\" always;",
                "add_header X-Content-Type-Options \"nosniff\" always;",
                "add_header X-Frame-Options \"SAMEORIGIN\" always;",
                "add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;",
            ),
        ),
    )
    lines.add("}")
    return lines.joinToString("\n")
}
