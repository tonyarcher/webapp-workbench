package userapi.accounts

import java.sql.SQLException
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID
import javax.sql.DataSource

class JdbcTotpStore(private val dataSource: DataSource) : TotpStore {
    override fun setPendingSecret(userId: UUID, secret: String) {
        dataSource.connection.use { conn ->
            conn.prepareStatement(SET_PENDING).use { ps ->
                ps.setString(1, secret)
                ps.setObject(2, userId)
                ps.executeUpdate()
            }
        }
    }

    override fun pendingSecret(userId: UUID): String? = scalar(GET_PENDING, userId)

    override fun enableSecret(userId: UUID, secret: String) {
        dataSource.connection.use { conn ->
            conn.prepareStatement(ENABLE).use { ps ->
                ps.setString(1, secret)
                ps.setObject(2, userId)
                ps.executeUpdate()
            }
        }
    }

    override fun enabledSecret(userId: UUID): String? = scalar(GET_ENABLED, userId)

    override fun replaceBackupHashes(userId: UUID, hashes: List<String>) {
        dataSource.connection.use { conn ->
            conn.autoCommit = false
            try {
                conn.prepareStatement(DELETE_CODES).use { ps ->
                    ps.setObject(1, userId)
                    ps.executeUpdate()
                }
                conn.prepareStatement(INSERT_CODE).use { ps ->
                    for (hash in hashes) {
                        ps.setObject(1, userId)
                        ps.setString(2, hash)
                        ps.addBatch()
                    }
                    ps.executeBatch()
                }
                conn.commit()
            } catch (ex: SQLException) {
                conn.rollback()
                throw ex
            } finally {
                conn.autoCommit = true
            }
        }
    }

    override fun consumeBackupHash(userId: UUID, codeHash: String): Boolean {
        dataSource.connection.use { conn ->
            conn.prepareStatement(CONSUME_CODE).use { ps ->
                ps.setObject(1, userId)
                ps.setString(2, codeHash)
                return ps.executeUpdate() == 1
            }
        }
    }

    override fun insertChallenge(userId: UUID, tokenHash: String, expiresAt: Instant) {
        dataSource.connection.use { conn ->
            conn.prepareStatement(INSERT_CHALLENGE).use { ps ->
                ps.setString(1, tokenHash)
                ps.setObject(2, userId)
                ps.setTimestamp(3, Timestamp.from(expiresAt))
                ps.executeUpdate()
            }
        }
    }

    override fun findChallenge(tokenHash: String, now: Instant): UUID? {
        dataSource.connection.use { conn ->
            conn.prepareStatement(FIND_CHALLENGE).use { ps ->
                ps.setString(1, tokenHash)
                ps.setTimestamp(2, Timestamp.from(now))
                ps.executeQuery().use { rs ->
                    return if (rs.next()) rs.getObject("user_id", UUID::class.java) else null
                }
            }
        }
    }

    override fun deleteChallenge(tokenHash: String) {
        dataSource.connection.use { conn ->
            conn.prepareStatement(DELETE_CHALLENGE).use { ps ->
                ps.setString(1, tokenHash)
                ps.executeUpdate()
            }
        }
    }

    private fun scalar(sql: String, userId: UUID): String? {
        dataSource.connection.use { conn ->
            conn.prepareStatement(sql).use { ps ->
                ps.setObject(1, userId)
                ps.executeQuery().use { rs ->
                    if (!rs.next()) return null
                    return rs.getString(1)
                }
            }
        }
    }
}

private const val SET_PENDING = "UPDATE users SET totp_pending = ? WHERE id = ?"
private const val GET_PENDING = "SELECT totp_pending FROM users WHERE id = ?"
private const val ENABLE = "UPDATE users SET totp_secret = ?, totp_pending = NULL WHERE id = ?"
private const val GET_ENABLED = "SELECT totp_secret FROM users WHERE id = ?"
private const val DELETE_CODES = "DELETE FROM backup_codes WHERE user_id = ?"
private const val INSERT_CODE = "INSERT INTO backup_codes (user_id, code_hash) VALUES (?, ?)"
private const val CONSUME_CODE = "DELETE FROM backup_codes WHERE user_id = ? AND code_hash = ?"
private const val INSERT_CHALLENGE =
    "INSERT INTO login_challenges (token_hash, user_id, expires_at) VALUES (?, ?, ?)"
private const val FIND_CHALLENGE =
    "SELECT user_id FROM login_challenges WHERE token_hash = ? AND expires_at > ?"
private const val DELETE_CHALLENGE = "DELETE FROM login_challenges WHERE token_hash = ?"
