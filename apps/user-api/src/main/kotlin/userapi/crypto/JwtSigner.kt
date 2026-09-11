package userapi.crypto

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.RSAKey
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import java.time.Instant
import java.util.Date
import java.util.UUID
import userapi.accounts.OAuthStore

const val ACCESS_TTL_SEC = 15 * 60
const val REFRESH_TTL_SEC = 7 * 24 * 60 * 60
const val AUTH_CODE_TTL_SEC = 10 * 60

class JwtSigner(store: OAuthStore, private val issuer: String) {
    private val key: RSAKey = loadOrCreate(store)
    private val signer = RSASSASigner(key.toPrivateKey())

    fun kid(): String = key.keyID

    fun jwksJson(): String = JWKSet(key.toPublicJWK()).toString()

    fun accessToken(userId: UUID, username: String, clientId: String, now: Instant): String {
        val claims = JWTClaimsSet.Builder()
            .issuer(issuer)
            .subject(userId.toString())
            .audience(clientId)
            .issueTime(Date.from(now))
            .expirationTime(Date.from(now.plusSeconds(ACCESS_TTL_SEC.toLong())))
            .jwtID(UUID.randomUUID().toString())
            .claim("preferred_username", username)
            .build()
        val jwt = SignedJWT(JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.keyID).build(), claims)
        jwt.sign(signer)
        return jwt.serialize()
    }
}

private fun loadOrCreate(store: OAuthStore): RSAKey {
    val existing = store.loadSigningJwk()
    if (existing != null) return RSAKey.parse(existing)
    val created = RSAKeyGenerator(2048).keyID(UUID.randomUUID().toString()).generate()
    store.saveSigningJwk(created.keyID, created.toJSONString())
    return created
}
