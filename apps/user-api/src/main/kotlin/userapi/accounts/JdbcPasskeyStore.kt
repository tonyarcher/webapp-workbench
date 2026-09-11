package userapi.accounts

import java.security.SecureRandom
import java.sql.Connection
import java.sql.ResultSet
import java.util.UUID
import javax.sql.DataSource

class JdbcPasskeyStore(private val dataSource: DataSource) : PasskeyStore {
    private val random = SecureRandom()

    override fun ensureUserHandle(userId: UUID): ByteArray {
        dataSource.connection.use { conn ->
            val existing = readHandle(conn, userId)
            if (existing != null) return existing
            val handle = ByteArray(32).also { random.nextBytes(it) }
            writeHandle(conn, userId, handle)
            return readHandle(conn, userId) ?: handle
        }
    }

    override fun usernameForHandle(handle: ByteArray): String? {
        dataSource.connection.use { conn ->
            conn.prepareStatement(USER_BY_HANDLE).use { ps ->
                ps.setBytes(1, handle)
                ps.executeQuery().use { rs -> return if (rs.next()) rs.getString(1) else null }
            }
        }
    }

    override fun handleForUsername(username: String): ByteArray? {
        dataSource.connection.use { conn ->
            conn.prepareStatement(HANDLE_BY_USER).use { ps ->
                ps.setString(1, username)
                ps.executeQuery().use { rs -> return if (rs.next()) rs.getBytes(1) else null }
            }
        }
    }

    override fun userIdForUsername(username: String): UUID? {
        dataSource.connection.use { conn ->
            conn.prepareStatement(ID_BY_USER).use { ps ->
                ps.setString(1, username)
                ps.executeQuery().use { rs ->
                    return if (rs.next()) rs.getObject(1, UUID::class.java) else null
                }
            }
        }
    }

    override fun insertPasskey(row: StoredPasskey) {
        dataSource.connection.use { conn ->
            conn.prepareStatement(INSERT).use { ps ->
                ps.setBytes(1, row.credentialId)
                ps.setObject(2, row.userId)
                ps.setBytes(3, row.userHandle)
                ps.setBytes(4, row.publicKey)
                ps.setLong(5, row.signCount)
                ps.executeUpdate()
            }
        }
    }

    override fun updateSignCount(credentialId: ByteArray, signCount: Long) {
        dataSource.connection.use { conn ->
            conn.prepareStatement(UPDATE_COUNT).use { ps ->
                ps.setLong(1, signCount)
                ps.setBytes(2, credentialId)
                ps.executeUpdate()
            }
        }
    }

    override fun passkeysForUsername(username: String): List<StoredPasskey> {
        dataSource.connection.use { conn ->
            conn.prepareStatement(BY_USERNAME).use { ps ->
                ps.setString(1, username)
                ps.executeQuery().use { rs -> return readAll(rs) }
            }
        }
    }

    override fun lookup(credentialId: ByteArray, userHandle: ByteArray): StoredPasskey? {
        dataSource.connection.use { conn ->
            conn.prepareStatement(LOOKUP).use { ps ->
                ps.setBytes(1, credentialId)
                ps.setBytes(2, userHandle)
                ps.executeQuery().use { rs -> return if (rs.next()) readRow(rs) else null }
            }
        }
    }

    override fun lookupAll(credentialId: ByteArray): List<StoredPasskey> {
        dataSource.connection.use { conn ->
            conn.prepareStatement(LOOKUP_ALL).use { ps ->
                ps.setBytes(1, credentialId)
                ps.executeQuery().use { rs -> return readAll(rs) }
            }
        }
    }

    override fun countForUser(userId: UUID): Int {
        dataSource.connection.use { conn ->
            conn.prepareStatement(COUNT).use { ps ->
                ps.setObject(1, userId)
                ps.executeQuery().use { rs ->
                    rs.next()
                    return rs.getInt(1)
                }
            }
        }
    }

}

private fun readHandle(conn: Connection, userId: UUID): ByteArray? {
    conn.prepareStatement(GET_HANDLE).use { ps ->
        ps.setObject(1, userId)
        ps.executeQuery().use { rs ->
            if (!rs.next()) return null
            return rs.getBytes(1)
        }
    }
}

private fun writeHandle(conn: Connection, userId: UUID, handle: ByteArray) {
    conn.prepareStatement(SET_HANDLE).use { ps ->
        ps.setBytes(1, handle)
        ps.setObject(2, userId)
        ps.executeUpdate()
    }
}

private fun readAll(rs: ResultSet): List<StoredPasskey> {
    val rows = mutableListOf<StoredPasskey>()
    while (rs.next()) rows.add(readRow(rs))
    return rows
}

private fun readRow(rs: ResultSet): StoredPasskey = StoredPasskey(
    credentialId = rs.getBytes("credential_id"),
    userId = rs.getObject("user_id", UUID::class.java),
    userHandle = rs.getBytes("user_handle"),
    publicKey = rs.getBytes("public_key"),
    signCount = rs.getLong("sign_count"),
)

private const val GET_HANDLE = "SELECT webauthn_handle FROM users WHERE id = ?"
private const val SET_HANDLE =
    "UPDATE users SET webauthn_handle = ? WHERE id = ? AND webauthn_handle IS NULL"
private const val USER_BY_HANDLE = "SELECT username FROM users WHERE webauthn_handle = ?"
private const val HANDLE_BY_USER = "SELECT webauthn_handle FROM users WHERE username = ?"
private const val ID_BY_USER = "SELECT id FROM users WHERE username = ?"
private const val INSERT =
    "INSERT INTO passkeys (credential_id, user_id, user_handle, public_key, sign_count) VALUES (?,?,?,?,?)"
private const val UPDATE_COUNT = "UPDATE passkeys SET sign_count = ? WHERE credential_id = ?"
private const val BY_USERNAME = """
SELECT p.credential_id, p.user_id, p.user_handle, p.public_key, p.sign_count
FROM passkeys p JOIN users u ON u.id = p.user_id WHERE u.username = ?
"""
private const val LOOKUP =
    "SELECT credential_id, user_id, user_handle, public_key, sign_count FROM passkeys WHERE credential_id = ? AND user_handle = ?"
private const val LOOKUP_ALL =
    "SELECT credential_id, user_id, user_handle, public_key, sign_count FROM passkeys WHERE credential_id = ?"
private const val COUNT = "SELECT COUNT(*) FROM passkeys WHERE user_id = ?"
