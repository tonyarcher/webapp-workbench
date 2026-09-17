package userapi.http

import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import userapi.accounts.OAuthStore
import userapi.accounts.StoredAuthCode
import userapi.accounts.StoredRefresh
import userapi.domain.OAuthClient

class FakeOAuthStore : OAuthStore {
    var jwk: String? = null
    private val clients = ConcurrentHashMap<String, OAuthClient>()
    private val codes = ConcurrentHashMap<String, Pair<StoredAuthCode, Instant>>()
    private val refresh = ConcurrentHashMap<String, StoredRefresh>()
    private val refreshExp = ConcurrentHashMap<String, Instant>()

    fun putClient(client: OAuthClient) {
        clients[client.id] = client
    }

    override fun findClient(clientId: String): OAuthClient? = clients[clientId]

    override fun loadSigningJwk(): String? = jwk

    override fun saveSigningJwk(kid: String, jwk: String) {
        if (this.jwk == null) this.jwk = jwk
    }

    override fun insertAuthCode(
        codeHash: String,
        userId: UUID,
        clientId: String,
        redirectUri: String,
        codeChallenge: String,
        expiresAt: Instant,
    ) {
        codes[codeHash] = StoredAuthCode(userId, clientId, redirectUri, codeChallenge) to expiresAt
    }

    override fun takeAuthCode(codeHash: String, now: Instant): StoredAuthCode? {
        val pair = codes.remove(codeHash) ?: return null
        return if (pair.second.isAfter(now)) pair.first else null
    }

    override fun insertRefresh(
        tokenHash: String,
        familyId: UUID,
        userId: UUID,
        clientId: String,
        expiresAt: Instant,
    ) {
        refresh[tokenHash] = StoredRefresh(familyId, userId, clientId, revoked = false)
        refreshExp[tokenHash] = expiresAt
    }

    override fun takeRefresh(tokenHash: String, now: Instant): StoredRefresh? {
        val exp = refreshExp[tokenHash] ?: return null
        if (!exp.isAfter(now)) return null
        val row = refresh[tokenHash] ?: return null
        if (row.revoked) return row.copy(revoked = true)
        refresh[tokenHash] = row.copy(revoked = true)
        return row.copy(revoked = false)
    }

    override fun revokeFamily(familyId: UUID) {
        refresh.replaceAll { _, v -> if (v.familyId == familyId) v.copy(revoked = true) else v }
    }
}
