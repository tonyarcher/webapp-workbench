package userapi.accounts

import java.sql.Timestamp
import java.time.Instant
import java.util.UUID
import javax.sql.DataSource

class JdbcOAuthStore(private val dataSource: DataSource) : OAuthStore {
    override fun findClient(clientId: String): userapi.domain.OAuthClient? {
        dataSource.connection.use { conn ->
            conn.prepareStatement(LOAD_REDIRECTS).use { ps ->
                ps.setString(1, clientId)
                ps.executeQuery().use { rs ->
                    val uris = mutableSetOf<String>()
                    while (rs.next()) uris.add(rs.getString(1))
                    if (uris.isEmpty()) return null
                    return userapi.domain.OAuthClient(clientId, uris)
                }
            }
        }
    }

    override fun loadSigningJwk(): String? {
        dataSource.connection.use { conn ->
            conn.prepareStatement(LOAD_JWK).use { ps ->
                ps.executeQuery().use { rs -> return if (rs.next()) rs.getString(1) else null }
            }
        }
    }

    override fun saveSigningJwk(kid: String, jwk: String) {
        dataSource.connection.use { conn ->
            conn.prepareStatement(SAVE_JWK).use { ps ->
                ps.setString(1, kid)
                ps.setString(2, jwk)
                ps.executeUpdate()
            }
        }
    }

    override fun insertAuthCode(
        codeHash: String,
        userId: UUID,
        clientId: String,
        redirectUri: String,
        codeChallenge: String,
        expiresAt: Instant,
    ) {
        dataSource.connection.use { conn ->
            conn.prepareStatement(INSERT_CODE).use { ps ->
                ps.setString(1, codeHash)
                ps.setObject(2, userId)
                ps.setString(3, clientId)
                ps.setString(4, redirectUri)
                ps.setString(5, codeChallenge)
                ps.setTimestamp(6, Timestamp.from(expiresAt))
                ps.executeUpdate()
            }
        }
    }

    override fun takeAuthCode(codeHash: String, now: Instant): StoredAuthCode? {
        dataSource.connection.use { conn ->
            conn.prepareStatement(TAKE_CODE).use { ps ->
                ps.setString(1, codeHash)
                ps.setTimestamp(2, Timestamp.from(now))
                ps.executeQuery().use { rs ->
                    if (!rs.next()) return null
                    return StoredAuthCode(
                        userId = rs.getObject("user_id", UUID::class.java),
                        clientId = rs.getString("client_id"),
                        redirectUri = rs.getString("redirect_uri"),
                        codeChallenge = rs.getString("code_challenge"),
                    )
                }
            }
        }
    }

    override fun insertRefresh(
        tokenHash: String,
        familyId: UUID,
        userId: UUID,
        clientId: String,
        expiresAt: Instant,
    ) {
        dataSource.connection.use { conn ->
            conn.prepareStatement(INSERT_REFRESH).use { ps ->
                ps.setString(1, tokenHash)
                ps.setObject(2, familyId)
                ps.setObject(3, userId)
                ps.setString(4, clientId)
                ps.setTimestamp(5, Timestamp.from(expiresAt))
                ps.executeUpdate()
            }
        }
    }

    override fun takeRefresh(tokenHash: String, now: Instant): StoredRefresh? {
        dataSource.connection.use { conn ->
            val unused = consumeUnusedRefresh(conn, tokenHash, now)
            if (unused != null) return unused
            return peekReusedRefresh(conn, tokenHash, now)
        }
    }

    override fun revokeFamily(familyId: UUID) {
        dataSource.connection.use { conn ->
            conn.prepareStatement(REVOKE_FAMILY).use { ps ->
                ps.setObject(1, familyId)
                ps.executeUpdate()
            }
        }
    }
}

private fun consumeUnusedRefresh(
    conn: java.sql.Connection,
    tokenHash: String,
    now: Instant,
): StoredRefresh? {
    conn.prepareStatement(TAKE_REFRESH).use { ps ->
        ps.setString(1, tokenHash)
        ps.setTimestamp(2, Timestamp.from(now))
        ps.executeQuery().use { rs ->
            if (!rs.next()) return null
            return StoredRefresh(
                familyId = rs.getObject("family_id", UUID::class.java),
                userId = rs.getObject("user_id", UUID::class.java),
                clientId = rs.getString("client_id"),
                revoked = false,
            )
        }
    }
}

private fun peekReusedRefresh(
    conn: java.sql.Connection,
    tokenHash: String,
    now: Instant,
): StoredRefresh? {
    conn.prepareStatement(PEEK_REUSED).use { ps ->
        ps.setString(1, tokenHash)
        ps.setTimestamp(2, Timestamp.from(now))
        ps.executeQuery().use { rs ->
            if (!rs.next()) return null
            return StoredRefresh(
                familyId = rs.getObject("family_id", UUID::class.java),
                userId = rs.getObject("user_id", UUID::class.java),
                clientId = rs.getString("client_id"),
                revoked = true,
            )
        }
    }
}

private const val LOAD_REDIRECTS =
    "SELECT redirect_uri FROM oauth_redirect_uris WHERE client_id = ?"
private const val LOAD_JWK = "SELECT jwk FROM oauth_signing_keys ORDER BY created_at DESC LIMIT 1"
private const val SAVE_JWK = "INSERT INTO oauth_signing_keys (kid, jwk) VALUES (?, ?) ON CONFLICT (kid) DO NOTHING"
private const val INSERT_CODE = """
INSERT INTO oauth_auth_codes
(code_hash, user_id, client_id, redirect_uri, code_challenge, expires_at)
VALUES (?,?,?,?,?,?)
"""
private const val TAKE_CODE = """
DELETE FROM oauth_auth_codes
WHERE code_hash = ? AND expires_at > ?
RETURNING user_id, client_id, redirect_uri, code_challenge
"""
private const val INSERT_REFRESH = """
INSERT INTO oauth_refresh_tokens
(token_hash, family_id, user_id, client_id, expires_at, revoked)
VALUES (?,?,?,?,?, false)
"""
private const val TAKE_REFRESH = """
UPDATE oauth_refresh_tokens
SET revoked = true
WHERE token_hash = ? AND expires_at > ? AND revoked = false
RETURNING family_id, user_id, client_id
"""
private const val PEEK_REUSED = """
SELECT family_id, user_id, client_id FROM oauth_refresh_tokens
WHERE token_hash = ? AND revoked = true AND expires_at > ?
"""
private const val REVOKE_FAMILY =
    "UPDATE oauth_refresh_tokens SET revoked = true WHERE family_id = ?"
