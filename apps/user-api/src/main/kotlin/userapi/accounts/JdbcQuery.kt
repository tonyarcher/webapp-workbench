package userapi.accounts

import java.sql.PreparedStatement
import java.sql.ResultSet
import javax.sql.DataSource

internal fun <T> queryOne(
    dataSource: DataSource,
    sql: String,
    bind: (PreparedStatement) -> Unit,
    read: (ResultSet) -> T?,
): T? {
    dataSource.connection.use { conn -> return queryIn(conn, sql, bind, read) }
}

private fun <T> queryIn(
    conn: java.sql.Connection,
    sql: String,
    bind: (PreparedStatement) -> Unit,
    read: (ResultSet) -> T?,
): T? {
    conn.prepareStatement(sql).use { ps -> return readPs(ps, bind, read) }
}

private fun <T> readPs(
    ps: PreparedStatement,
    bind: (PreparedStatement) -> Unit,
    read: (ResultSet) -> T?,
): T? {
    bind(ps)
    ps.executeQuery().use { rs -> return read(rs) }
}
