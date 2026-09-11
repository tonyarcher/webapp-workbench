package userapi.http

import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.Parameters
import io.ktor.http.formUrlEncode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receiveParameters
import io.ktor.server.response.respond
import io.ktor.server.response.respondRedirect
import io.ktor.server.response.respondText
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.OAuthService
import userapi.accounts.TokenPair

@Serializable
data class OAuthErrorBody(val error: String)

@Serializable
data class TokenResponseBody(
    @SerialName("access_token") val accessToken: String,
    @SerialName("token_type") val tokenType: String = "Bearer",
    @SerialName("expires_in") val expiresIn: Int,
    @SerialName("refresh_token") val refreshToken: String,
)

internal suspend fun oauthAuthorize(call: ApplicationCall, settings: Settings, accounts: AccountServices) {
    val oauth = requireOauth(call, accounts) ?: return
    val store = requireStore(call, accounts) ?: return
    val params = call.request.queryParameters
    if (!authorizeParamsOk(oauth, params)) {
        call.respond(HttpStatusCode.BadRequest, ErrBody(ErrDetail("oauth", "invalid authorize request")))
        return
    }
    val session = peekSession(call, accounts, store)
    if (session == null) {
        call.respondRedirect(loginRedirect(settings, call.request.queryParameters.formUrlEncode()))
        return
    }
    val code = oauth.issueCode(
        session.userId,
        params["client_id"].orEmpty(),
        params["redirect_uri"].orEmpty(),
        params["code_challenge"].orEmpty(),
    )
    call.respondRedirect(redirectWithCode(params["redirect_uri"].orEmpty(), code, params["state"]))
}

internal fun authorizeParamsOk(oauth: OAuthService, params: Parameters): Boolean {
    val clientId = params["client_id"].orEmpty()
    val redirect = params["redirect_uri"].orEmpty()
    if (!oauth.allowedRedirect(clientId, redirect)) return false
    if (params["response_type"] != "code") return false
    if (params["code_challenge_method"] != "S256") return false
    return params["code_challenge"].orEmpty().length >= 43
}

internal suspend fun oauthToken(call: ApplicationCall, accounts: AccountServices) {
    val oauth = requireOauth(call, accounts) ?: return
    if (!accounts.limiter.allow("oauth:" + call.clientIp())) {
        call.rejectRate()
        return
    }
    val form = call.receiveParameters()
    when (form["grant_type"]) {
        "authorization_code" -> tokenFromCode(call, accounts, oauth, form)
        "refresh_token" -> tokenFromRefresh(call, accounts, oauth, form)
        else -> call.respond(HttpStatusCode.BadRequest, OAuthErrorBody("unsupported_grant_type"))
    }
}

internal suspend fun oauthJwks(call: ApplicationCall, accounts: AccountServices) {
    val oauth = requireOauth(call, accounts) ?: return
    call.respondText(oauth.signer.jwksJson(), ContentType.Application.Json)
}

internal suspend fun requireOauth(call: ApplicationCall, accounts: AccountServices): OAuthService? {
    val found = accounts.oauth
    if (found != null) return found
    call.respond(HttpStatusCode.ServiceUnavailable, ErrBody(ErrDetail("unavailable", "oauth offline")))
    return null
}

private suspend fun tokenFromCode(
    call: ApplicationCall,
    accounts: AccountServices,
    oauth: OAuthService,
    form: Parameters,
) {
    val store = requireStore(call, accounts) ?: return
    val pair = oauth.exchangeCode(
        code = form["code"].orEmpty(),
        clientId = form["client_id"].orEmpty(),
        redirectUri = form["redirect_uri"].orEmpty(),
        verifier = form["code_verifier"].orEmpty(),
    ) { id -> store.findById(id)?.username }
    respondToken(call, pair)
}

private suspend fun tokenFromRefresh(
    call: ApplicationCall,
    accounts: AccountServices,
    oauth: OAuthService,
    form: Parameters,
) {
    val store = requireStore(call, accounts) ?: return
    val pair = oauth.rotateRefresh(form["refresh_token"].orEmpty()) { id -> store.findById(id)?.username }
    respondToken(call, pair)
}

private suspend fun respondToken(call: ApplicationCall, pair: TokenPair?) {
    if (pair == null) {
        call.respond(HttpStatusCode.BadRequest, OAuthErrorBody("invalid_grant"))
        return
    }
    call.respond(
        TokenResponseBody(
            accessToken = pair.accessToken,
            expiresIn = pair.expiresIn,
            refreshToken = pair.refreshToken,
        ),
    )
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
