package fitnessapi.store

import java.sql.Connection
import javax.sql.DataSource

fun <T> DataSource.withTx(work: (Connection) -> T): T {
    connection.use { conn ->
        conn.autoCommit = false
        var committed = false
        try {
            val result = work(conn)
            conn.commit()
            committed = true
            return result
        } finally {
            if (!committed) conn.rollback()
            conn.autoCommit = true
        }
    }
}

fun <T> DataSource.withConn(work: (Connection) -> T): T = connection.use(work)
