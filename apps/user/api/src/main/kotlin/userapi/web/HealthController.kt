package userapi.web

import java.sql.SQLException
import javax.sql.DataSource
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class HealthController(private val dataSource: DataSource) {
    @GetMapping("/healthz")
    fun healthz(): HealthBody = HealthBody(ok = true)

    @GetMapping("/readyz")
    fun readyz(): ResponseEntity<HealthBody> {
        if (!probe(dataSource)) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(HealthBody(ok = false))
        }
        return ResponseEntity.ok(HealthBody(ok = true))
    }
}

private fun probe(dataSource: DataSource): Boolean {
    return try {
        probeOnce(dataSource)
    } catch (_: SQLException) {
        false
    }
}

private fun probeOnce(dataSource: DataSource): Boolean {
    dataSource.connection.use { conn -> return queryOne(conn) }
}

private fun queryOne(conn: java.sql.Connection): Boolean {
    conn.createStatement().use { st -> return queryRow(st) }
}

private fun queryRow(st: java.sql.Statement): Boolean {
    st.executeQuery("SELECT 1").use { rs -> return rs.next() }
}
