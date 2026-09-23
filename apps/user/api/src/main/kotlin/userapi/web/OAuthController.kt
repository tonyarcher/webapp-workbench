package userapi.web

import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.OAuthService
import userapi.accounts.TokenPair
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/** RFC 7636: a PKCE S256 challenge is a base64url SHA-256 digest (43 chars min). */
private const val MIN_CODE_CHALLENGE_CHARS = 43

@RestController
class OAuthController(private val accounts: AccountServices, private val settings: Settings) {
    @GetMapping("/oauth/authorize")
    fun authorize(@RequestParam params: Map<String, String>, request: HttpServletRequest): ResponseEntity<Void> {
        val oauth = requireOauth()
        val store = requireStore(accounts)
        if (!authorizeParamsOk(oauth, params)) {
            throw ApiException(HttpStatus.BAD_REQUEST, "oauth", "invalid authorize request")
        }
        val session = peekSession(request)
        if (session == null) {
            return redirect(loginRedirect(settings, rawQuery(request)))
        }
        val code = oauth.issueCode(
            session.userId,
            params["client_id"].orEmpty(),
            params["redirect_uri"].orEmpty(),
            params["code_challenge"].orEmpty(),
        )
        return redirect(redirectWithCode(params["redirect_uri"].orEmpty(), code, params["state"]))
    }

    @PostMapping("/oauth/token")
    fun token(@RequestParam form: Map<String, String>, request: HttpServletRequest): TokenResponseBody {
        val oauth = requireOauth()
        checkRate(accounts, "oauth", request)
        val pair = when (form["grant_type"]) {
            "authorization_code" -> tokenFromCode(oauth, form)
            "refresh_token" -> tokenFromRefresh(oauth, form)
            else -> throw OAuthTokenException("unsupported_grant_type")
        }
        return TokenResponseBody(
            accessToken = pair.accessToken,
            expiresIn = pair.expiresIn,
            refreshToken = pair.refreshToken,
        )
    }

    @GetMapping("/oauth/jwks", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun jwks(): String = requireOauth().signer.jwksJson()

    private fun requireOauth(): OAuthService =
        accounts.oauth ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "oauth offline")

    private fun tokenFromCode(oauth: OAuthService, form: Map<String, String>): TokenPair {
        val store = requireStore(accounts)
        return oauth.exchangeCode(
            code = form["code"].orEmpty(),
            clientId = form["client_id"].orEmpty(),
            redirectUri = form["redirect_uri"].orEmpty(),
            verifier = form["code_verifier"].orEmpty(),
        ) { id -> store.findById(id)?.username } ?: throw OAuthTokenException("invalid_grant")
    }

    private fun tokenFromRefresh(oauth: OAuthService, form: Map<String, String>): TokenPair {
        val store = requireStore(accounts)
        return oauth.rotateRefresh(form["refresh_token"].orEmpty()) { id -> store.findById(id)?.username }
            ?: throw OAuthTokenException("invalid_grant")
    }

    private fun redirect(url: String): ResponseEntity<Void> =
        ResponseEntity.status(HttpStatus.FOUND).header("Location", url).build()

    private fun rawQuery(request: HttpServletRequest): String? = request.queryString
}

internal fun authorizeParamsOk(oauth: OAuthService, params: Map<String, String>): Boolean {
    val clientId = params["client_id"].orEmpty()
    val redirect = params["redirect_uri"].orEmpty()
    if (!oauth.allowedRedirect(clientId, redirect)) return false
    if (params["response_type"] != "code") return false
    if (params["code_challenge_method"] != "S256") return false
    return params["code_challenge"].orEmpty().length >= MIN_CODE_CHALLENGE_CHARS
}

internal fun loginRedirect(settings: Settings, query: String?): String {
    val path = "/user-api/oauth/authorize" + if (query.isNullOrBlank()) "" else "?$query"
    val encoded = URLEncoder.encode(path, StandardCharsets.UTF_8)
    return settings.loginPath + "?return=" + encoded
}

internal fun redirectWithCode(redirectUri: String, code: String, state: String?): String {
    val sep = if (redirectUri.contains('?')) '&' else '?'
    val base = "$redirectUri${sep}code=$code"
    return if (state.isNullOrBlank()) base else "$base&state=$state"
}
