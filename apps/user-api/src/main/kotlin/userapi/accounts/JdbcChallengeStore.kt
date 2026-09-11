package userapi.accounts

import java.sql.Timestamp
import java.time.Instant
import java.util.UUID
import javax.sql.DataSource

class JdbcChallengeStore(private val dataSource: DataSource) : WebauthnChallengeStore {
    override fun putChallenge(row: WebauthnChallenge, expiresAt: Instant) {
        dataSource.connection.use { conn ->
            conn.prepareStatement(INSERT).use { ps ->
                ps.setString(1, row.id)
                ps.setString(2, row.kind)
                ps.setObject(3, row.userId)
                ps.setString(4, row.payload)
                ps.setTimestamp(5, Timestamp.from(expiresAt))
                ps.executeUpdate()
            }
        }
    }

    override fun takeChallenge(id: String, now: Instant): WebauthnChallenge? {
        dataSource.connection.use { conn ->
            conn.prepareStatement(TAKE).use { ps ->
                ps.setString(1, id)
                ps.setTimestamp(2, Timestamp.from(now))
                ps.executeQuery().use { rs -> return if (rs.next()) read(rs) else null }
            }
        }
    }
}

private fun read(rs: java.sql.ResultSet): WebauthnChallenge = WebauthnChallenge(
    id = rs.getString("id"),
    kind = rs.getString("kind"),
    userId = rs.getObject("user_id", UUID::class.java),
    payload = rs.getString("payload"),
)

private const val INSERT =
    "INSERT INTO webauthn_challenges (id, kind, user_id, payload, expires_at) VALUES (?,?,?,?,?)"
private const val TAKE = """
DELETE FROM webauthn_challenges
WHERE id = ? AND expires_at > ?
RETURNING id, kind, user_id, payload
"""
