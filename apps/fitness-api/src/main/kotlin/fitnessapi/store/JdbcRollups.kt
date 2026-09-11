package fitnessapi.store

import java.sql.Connection
import java.util.UUID

internal fun rebuildRollups(conn: Connection, userId: UUID, metrics: List<String>) {
    if (metrics.isEmpty()) return
    val arr = conn.createArrayOf("text", metrics.toTypedArray())
    conn.prepareStatement(DELETE_ROLLUPS_SQL).use { ps ->
        ps.setObject(1, userId)
        ps.setArray(2, arr)
        ps.executeUpdate()
    }
    val insertArr = conn.createArrayOf("text", metrics.toTypedArray())
    conn.prepareStatement(INSERT_ROLLUPS_SQL).use { ps ->
        ps.setObject(1, userId)
        ps.setArray(2, insertArr)
        ps.executeUpdate()
    }
}
