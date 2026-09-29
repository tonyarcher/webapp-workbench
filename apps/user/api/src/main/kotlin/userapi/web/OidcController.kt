package userapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.crypto.AccessClaims

private const val BEARER_PREFIX = "Bearer "

/** Authorization Code only. There is no implicit or hybrid flow to advertise. */
private const val RESPONSE_TYPE_CODE = "code"

/**
 * The OIDC discovery document and userinfo, kept apart from the authorization
 * and token endpoints.
 *
 * Gitea's OpenID Connect source fetches discovery and takes its endpoints from
 * there rather than being configured with them one at a time, so without this
 * controller its sign-in button cannot resolve an authorization endpoint at all.
 * The two concerns also want different reasoning: the token endpoint is where
 * credentials are checked, these are where they are described and read.
 */
@RestController
class OidcController(
    private val accounts: AccountServices,
    private val settings: Settings,
    private val mapper: ObjectMapper,
) {
    /**
     * The two bases are not interchangeable.
     *
     * authorization_endpoint is followed by a browser, so it carries the public
     * origin and the gateway prefix. The other three are called by the client
     * process from inside the compose network, where that prefix has already
     * been stripped and the service name is not routable from a browser.
     * Publishing the public base for all four looks tidier and breaks exactly
     * the server-to-server calls.
     */
    @GetMapping("/.well-known/openid-configuration", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun discovery(): String = discoveryDocument(mapper, settings)

    /**
     * The claims for whoever the presented access token belongs to.
     *
     * It answers from the token and never from the session: a browser cookie and
     * a bearer token are different credentials, and letting one stand in for the
     * other would hand a CSRF-able cookie the authority of a token that a client
     * had to present deliberately.
     */
    @GetMapping("/oauth/userinfo", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun userinfo(request: HttpServletRequest): String {
        val bearer = bearerToken(request)
            ?: throw ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "not signed in")
        val claims = requireNotNull(accounts.oauth).signer
            .verifyAccessToken(bearer, accounts.clock.instant())
            ?: throw ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "invalid access token")
        return userInfoBody(mapper, claims)
    }

    private fun bearerToken(request: HttpServletRequest): String? {
        val header = request.getHeader("Authorization")?.trim().orEmpty()
        if (!header.startsWith(BEARER_PREFIX, ignoreCase = true)) return null
        return header.removePrefix(BEARER_PREFIX).trim().ifBlank { null }
    }
}

/**
 * The discovery document, as a map so the mapper owns the JSON.
 *
 * `id_token_signing_alg_values_supported` was absent while no id_token was
 * issued, rather than claiming one that did not exist. It is present now because
 * one is issued, and goth's openidConnect client refuses to complete a login
 * without it. `scopes_supported` stays absent: this service issues no
 * scope-specific claims, so naming scopes would describe a feature that is not
 * there.
 */
internal fun discoveryDocument(mapper: ObjectMapper, settings: Settings): String {
    val public = settings.publicBase
    val internal = settings.internalBase
    return mapper.writeValueAsString(
        mapOf(
            "issuer" to settings.issuer,
            "authorization_endpoint" to "$public/oauth/authorize",
            "token_endpoint" to "$internal/oauth/token",
            "userinfo_endpoint" to "$internal/oauth/userinfo",
            "jwks_uri" to "$internal/oauth/jwks",
            "response_types_supported" to listOf(RESPONSE_TYPE_CODE),
            "grant_types_supported" to listOf("authorization_code", "refresh_token"),
            "code_challenge_methods_supported" to listOf("S256"),
            "subject_types_supported" to listOf("public"),
            "id_token_signing_alg_values_supported" to listOf("RS256"),
            "token_endpoint_auth_methods_supported" to listOf("client_secret_post"),
        ),
    )
}

/**
 * userinfo claims. `sub` is the stable account id and is what Gitea keys the
 * external account on; `preferred_username` is what a person recognises.
 *
 * There is no `email` because accounts have no address, and inventing one from
 * the username would put a value in front of Gitea that looks deliverable and
 * is not. Gitea is configured to skip email verification for that reason.
 */
internal fun userInfoBody(mapper: ObjectMapper, claims: AccessClaims): String = mapper.writeValueAsString(
    mapOf(
        "sub" to claims.subject,
        "preferred_username" to claims.username,
        "name" to claims.username,
    ),
)
