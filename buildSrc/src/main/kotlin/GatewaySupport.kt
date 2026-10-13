package workbench

import org.gradle.api.Project

/*
 * Gateway rendering: the @@TOKEN@@ values, the TLS host list, and the idempotent
 * render of deploy/nginx/default.conf from its template. Split out of
 * DeploySupport.kt to stay under the max-lines floor; it depends on the
 * asset-origin block builder in S3Support.kt, which is in the same package.
 */

fun splitHosts(raw: String): List<String> = raw.replace(",", " ").split(Regex("\\s+")).filter { it.isNotEmpty() }

/**
 * TLS hosts plus the asset origin's host. The leaf must cover the asset host or
 * the browser rejects the asset origin, so it joins the SANs automatically
 * rather than depending on `TLS_HOSTS` carrying it by hand. Empty when TLS is
 * off, so the asset host never turns TLS on by itself.
 */
fun certHostsOf(env: Map<String, String>, tlsHosts: List<String>): List<String> {
    if (tlsHosts.isEmpty()) return tlsHosts
    val assetsHost = env["ASSETS_HOST"]?.trim().orEmpty()
    return (tlsHosts + assetsHost).filter { it.isNotEmpty() }.distinct()
}

/** Values for the @@TOKEN@@ placeholders in the gateway template. */
fun Project.gatewayTokens(hosts: List<String>): Map<String, String> {
    val env = gatewayEnv()
    val tls = hosts.isNotEmpty()
    val redirect = tls && env["TLS_REDIRECT"] == "1"
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
        "API_ROUTES" to apiRoutesToken(appCatalog.apiRoutes),
        "ASSET_SERVER" to assetServerBlock(s3Apps(env), env, tls, redirect),
        // The same per-app location set, on the gateway's own host. One nginx
        // serves every app from the store, so the per-app UI containers are
        // gone; this is the only path that serves them, which is why an unset
        // S3_BUCKET is a deploy error rather than a silent 404 (see deployValidate).
        "APP_LOCATIONS" to appLocationsToken(s3Apps(env), env),
    )
}

/**
 * One prefix-stripping API proxy route: the public subpath, the nginx
 * variable name for its upstream, the compose address, and an optional
 * `proxy_read_timeout` for an API whose responses can outlast nginx's 60s
 * default. Derived from the catalog's `apiRoutes` (see [apiRoutesOf]); adding
 * an API is one catalog entry, not a copied location block.
 */
internal data class ApiRoute(
    val publicPath: String,
    val upstreamVar: String,
    val upstream: String,
    val readTimeout: String? = null,
)

/**
 * Derive the gateway routes from the catalog: the service key names the
 * compose address (`http://<service>:3000`) and, with dashes swapped for
 * underscores, the nginx variable — the shapes every hand-written block
 * already used. Only the public path and any timeout come from the catalog,
 * because neither is derivable from the service name.
 */
internal fun apiRoutesOf(specs: Map<String, ApiRouteSpec>): List<ApiRoute> = specs.map { (service, spec) ->
    ApiRoute(
        publicPath = spec.path,
        upstreamVar = "upstream_${service.replace('-', '_')}",
        upstream = "http://$service:3000",
        readTimeout = spec.readTimeout,
    )
}

/** The API routes block for the @@API_ROUTES@@ token: shared shape, one entry per API. */
internal fun apiRoutesToken(specs: Map<String, ApiRouteSpec>): String =
    apiRoutesOf(specs).joinToString("\n\n") { route ->
        buildString {
            appendLine("    location ^~ ${route.publicPath} {")
            appendLine("        set \$${route.upstreamVar} ${route.upstream};")
            appendLine("        rewrite ^${route.publicPath}(.*)\$ /\$1 break;")
            appendLine("        proxy_pass \$${route.upstreamVar};")
            appendLine("        proxy_http_version 1.1;")
            route.readTimeout?.let { appendLine("        proxy_read_timeout $it;") }
            appendLine("        proxy_set_header Host \$host;")
            appendLine("        proxy_set_header X-Real-IP \$remote_addr;")
            appendLine("        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;")
            appendLine("        proxy_set_header X-Forwarded-Proto \$scheme;")
            appendLine("        proxy_set_header X-Request-ID \$request_id;")
            append("    }")
        }
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
    val env = gatewayEnv()
    val template = file("deploy/nginx/default.conf.template").readText()
    val hosts = splitHosts(env["TLS_HOSTS"] ?: "")
    // The consolidated static apps have no per-app container: the gateway serves
    // them from the object store, so an unset store leaves them with no serving
    // path at all. Fail loudly rather than render a config that 404s them.
    // `down` and `status` still render, so the stack can be stopped without it.
    if (!deployHas("down") && !deployHas("status") && env["S3_BUCKET"].isNullOrBlank()) {
        error(
            "S3_BUCKET is required: the gateway serves every static app from the object " +
                "store, and their per-app containers are gone",
        )
    }
    val output = renderLines(template, gatewayTokens(hosts))
    // An unexpanded `${NAME}` reaches nginx as a variable reference and stops it
    // dead ("unknown ... variable"), taking every route down. Catch it here, with
    // the line, rather than shipping a config that crash-loops the gateway.
    val rendered = output.joinToString("\n")
    val stray = rendered.lineSequence().withIndex()
        .firstOrNull { (_, line) -> "\${" in line && !line.trim().startsWith("#") }
    if (stray != null) {
        error(
            "unexpanded \${...} in the rendered gateway config at line ${stray.index + 1}: " +
                stray.value.trim(),
        )
    }
    file("deploy/nginx/default.conf").writeText(rendered)
    if (hosts.isNotEmpty()) {
        println("==> gateway TLS on for: ${hosts.joinToString(", ")}")
    } else {
        println("==> gateway plain HTTP (TLS_HOSTS empty)")
    }
}
