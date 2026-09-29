package userapi.crypto

import com.nimbusds.jose.JOSEException
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jose.crypto.RSASSAVerifier
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.RSAKey
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import userapi.accounts.OAuthStore
import java.security.interfaces.RSAPublicKey
import java.text.ParseException
import java.time.Instant
import java.util.Date
import java.util.UUID

const val ACCESS_TTL_SEC: Int = 15 * 60
const val REFRESH_TTL_SEC: Int = 7 * 24 * 60 * 60
const val AUTH_CODE_TTL_SEC: Int = 10 * 60

/** What a verified access token asserts about its bearer. */
data class AccessClaims(val subject: String, val username: String, val clientId: String)

class JwtSigner(store: OAuthStore, private val issuer: String) {
    private val key: RSAKey = loadOrCreate(store)
    private val signer = RSASSASigner(key.toPrivateKey())

    // toPublicKey() is declared as the general PublicKey in this Nimbus version,
    // so the RSAPublicKey the verifier needs has to be named rather than inferred.
    private val verifier = RSASSAVerifier(key.toPublicKey() as RSAPublicKey)

    fun kid(): String = key.keyID

    fun jwksJson(): String = JWKSet(key.toPublicJWK()).toString()

    fun accessToken(userId: UUID, username: String, clientId: String, now: Instant): String =
        identityToken(userId, username, clientId, now)

    /**
     * The OIDC identity token.
     *
     * Same claims and same audience as the access token, and a separate
     * signature, because the two answer different questions: one says "you may
     * call the API", the other "this is who you are". goth's openidConnect
     * provider will not complete a login without one, and it validates `aud`
     * against the client id and `iss` against the discovery issuer, so both are
     * set to the same values the access token carries.
     *
     * [nonce] is echoed only when the authorization request carried one. OIDC
     * Core 3.1.3.7 requires the token to repeat it unchanged, and a client that
     * sent a nonce refuses a token without it -- Wiki.js sends one on every
     * login and checks it. An empty nonce adds no claim, so a client that sent
     * none sees an id_token of exactly the shape it expects.
     */
    @Suppress("LongParameterList")
    fun identityToken(userId: UUID, username: String, clientId: String, now: Instant, nonce: String = ""): String {
        val claims = JWTClaimsSet.Builder()
            .issuer(issuer)
            .subject(userId.toString())
            .audience(clientId)
            .issueTime(Date.from(now))
            .expirationTime(Date.from(now.plusSeconds(ACCESS_TTL_SEC.toLong())))
            .jwtID(UUID.randomUUID().toString())
            .claim("preferred_username", username)
            .claim("name", username)
            .apply { if (nonce.isNotEmpty()) claim("nonce", nonce) }
            .build()
        val jwt = SignedJWT(JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.keyID).build(), claims)
        jwt.sign(signer)
        return jwt.serialize()
    }

    /**
     * Verify one of our own access tokens, or null if it is not ours or is stale.
     *
     * The audience is deliberately NOT checked. It holds the OAuth client id,
     * not this service, so requiring it to name user-api would reject every
     * legitimate token. What a resource server can actually assert is the
     * signature, our own issuer, and the expiry.
     *
     * The algorithm is pinned to RS256 before verifying rather than taken from
     * the header, so a token asking for "none" or for HMAC is rejected instead
     * of steered at a verifier built from the wrong key type.
     */
    fun verifyAccessToken(token: String, now: Instant): AccessClaims? {
        val jwt = parseSigned(token) ?: return null
        if (jwt.header.algorithm != JWSAlgorithm.RS256) return null
        if (!jwt.verify(verifier)) return null
        return claimsFrom(jwt, now)
    }

    private fun parseSigned(token: String): SignedJWT? = try {
        SignedJWT.parse(token)
    } catch (malformed: ParseException) {
        null
    }

    private fun claimsFrom(jwt: SignedJWT, now: Instant): AccessClaims? {
        val claims = jwt.jwtClaimsSet
        if (claims.issuer != issuer) return null
        if (!stillValid(claims.expirationTime, now)) return null
        val subject = claims.subject ?: return null
        val username = claims.getStringClaim("preferred_username") ?: return null
        return AccessClaims(subject, username, claims.audience?.firstOrNull().orEmpty())
    }

    private fun stillValid(expiry: Date?, now: Instant): Boolean = expiry != null && expiry.after(Date.from(now))
}

private fun loadOrCreate(store: OAuthStore): RSAKey {
    val existing = store.loadSigningJwk()
    if (existing != null) return RSAKey.parse(existing)
    val created = RSAKeyGenerator(2048).keyID(UUID.randomUUID().toString()).generate()
    store.saveSigningJwk(created.keyID, created.toJSONString())
    return created
}
