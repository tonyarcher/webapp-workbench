package userapi.accounts

import java.sql.Connection
import java.sql.SQLException
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID
import javax.sql.DataSource
import userapi.domain.LockoutState

class JdbcAccountStore(private val dataSource: DataSource) : AccountStore {
    override fun createUser(username: String, passwordHash: String): UUID? {
        return try {
            withConn { conn -> insertUser(conn, username, passwordHash) }
        } catch (ex: SQLException) {
            if (ex.sqlState == "23505") null else throw ex
        }
    }

    override fun findByUsername(username: String): StoredUser? = withConn { conn ->
        conn.prepareStatement(FIND_BY_USERNAME).use { ps ->
            ps.setString(1, username)
            ps.executeQuery().use { rs -> if (rs.next()) readUser(rs) else null }
        }
    }

    override fun findById(id: UUID): StoredUser? = withConn { conn ->
        conn.prepareStatement(FIND_BY_ID).use { ps ->
            ps.setObject(1, id)
            ps.executeQuery().use { rs -> if (rs.next()) readUser(rs) else null }
        }
    }

    override fun writeLockout(id: UUID, state: LockoutState) {
        withConn { conn ->
            conn.prepareStatement(WRITE_LOCKOUT).use { ps ->
                ps.setInt(1, state.failedLogins)
                ps.setTimestamp(2, state.lockedUntil?.let { Timestamp.from(it) })
                ps.setObject(3, id)
                ps.executeUpdate()
            }
        }
    }

    override fun insertSession(userId: UUID, tokenHash: String, expiresAt: Instant) {
        withConn { conn ->
            conn.prepareStatement(INSERT_SESSION).use { ps ->
                ps.setObject(1, userId)
                ps.setString(2, tokenHash)
                ps.setTimestamp(3, Timestamp.from(expiresAt))
                ps.executeUpdate()
            }
        }
    }

    override fun findSession(tokenHash: String, now: Instant): StoredSession? = withConn { conn ->
        conn.prepareStatement(FIND_SESSION).use { ps ->
            ps.setString(1, tokenHash)
            ps.setTimestamp(2, Timestamp.from(now))
            ps.executeQuery().use { rs ->
                if (!rs.next()) null
                else StoredSession(
                    userId = rs.getObject("user_id", UUID::class.java),
                    username = rs.getString("username"),
                    expiresAt = rs.getTimestamp("expires_at").toInstant(),
                )
            }
        }
    }

    override fun deleteSession(tokenHash: String) {
        withConn { conn ->
            conn.prepareStatement(DELETE_SESSION).use { ps ->
                ps.setString(1, tokenHash)
                ps.executeUpdate()
            }
        }
    }

    private fun <T> withConn(block: (Connection) -> T): T = dataSource.connection.use(block)
}

private fun insertUser(conn: Connection, username: String, passwordHash: String): UUID {
    conn.prepareStatement(INSERT_USER).use { ps ->
        ps.setString(1, username)
        ps.setString(2, passwordHash)
        ps.executeQuery().use { rs ->
            check(rs.next()) { "insert user returned no id" }
            return rs.getObject("id", UUID::class.java)
        }
    }
}

private fun readUser(rs: java.sql.ResultSet): StoredUser = StoredUser(
    id = rs.getObject("id", UUID::class.java),
    username = rs.getString("username"),
    passwordHash = rs.getString("password_hash"),
    failedLogins = rs.getInt("failed_logins"),
    lockedUntil = rs.getTimestamp("locked_until")?.toInstant(),
)

private const val INSERT_USER =
    "INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id"
private const val FIND_BY_USERNAME =
    "SELECT id, username, password_hash, failed_logins, locked_until FROM users WHERE username = ?"
private const val FIND_BY_ID =
    "SELECT id, username, password_hash, failed_logins, locked_until FROM users WHERE id = ?"
private const val WRITE_LOCKOUT =
    "UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?"
private const val INSERT_SESSION =
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)"
private const val FIND_SESSION = """
SELECT s.user_id, u.username, s.expires_at
FROM sessions s JOIN users u ON u.id = s.user_id
WHERE s.token_hash = ? AND s.expires_at > ?
"""
private const val DELETE_SESSION = "DELETE FROM sessions WHERE token_hash = ?"
