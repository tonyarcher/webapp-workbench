package stockgame.db

import java.sql.Connection
import java.sql.DriverManager

fun ensureDatabase(databaseUrl: String) {
    val target = parseDatabaseUrl(databaseUrl)
    DriverManager.getConnection(adminJdbcUrl(target), target.user, target.password).use { conn ->
        if (databaseExists(conn, target.database)) return
        conn.createStatement().use { st -> st.execute(createDatabaseSql(target.database)) }
    }
}

private fun databaseExists(conn: Connection, name: String): Boolean {
    conn.prepareStatement("SELECT 1 FROM pg_database WHERE datname = ?").use { ps ->
        ps.setString(1, name)
        ps.executeQuery().use { rs -> return rs.next() }
    }
}
