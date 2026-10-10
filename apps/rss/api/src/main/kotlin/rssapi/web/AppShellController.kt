package rssapi.web

import org.springframework.core.env.Environment
import org.springframework.http.CacheControl
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Serves the reader's HTML shell. Unauthenticated and unversioned like the
 * other probes/discovery, because the browser loads it before the OAuth flow
 * completes and before any `X-Api-Version` can be attached. The gateway will
 * route `/rss-reader/` here once static assets move to the CDN.
 */
@RestController
class AppShellController(private val env: Environment) {
    @GetMapping("/app", produces = [MediaType.TEXT_HTML_VALUE])
    fun appShell(): ResponseEntity<String> = ResponseEntity.ok()
        .cacheControl(CacheControl.noCache())
        .contentType(MediaType.TEXT_HTML)
        .body(renderShell(shellConfigFromEnv(env)))
}
