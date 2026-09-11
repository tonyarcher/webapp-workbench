package userapi.domain

const val OAUTH_RESPONSE_TYPE = "code"

data class OAuthClient(
    val id: String,
    val redirects: Set<String>,
)

fun redirectAllowed(client: OAuthClient, redirectUri: String): Boolean =
    redirectUri in client.redirects
