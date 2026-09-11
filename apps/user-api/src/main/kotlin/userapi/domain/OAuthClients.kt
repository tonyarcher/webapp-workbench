package userapi.domain

const val OAUTH_RESPONSE_TYPE = "code"

data class OAuthClient(
    val id: String,
    val redirects: Set<String>,
)

fun redirectAllowed(client: OAuthClient, redirectUri: String): Boolean =
    redirectUri in client.redirects

fun defaultOAuthClients(origins: Set<String>): List<OAuthClient> {
    val paths = listOf(
        "fitness" to "/fitness/",
        "rss-reader" to "/rss-reader/",
        "user-web" to "/auth/",
    )
    return paths.map { (id, path) ->
        OAuthClient(
            id = id,
            redirects = origins.map { origin -> origin.trimEnd('/') + path }.toSet(),
        )
    }
}

fun clientById(clients: List<OAuthClient>, id: String): OAuthClient? =
    clients.find { it.id == id }
