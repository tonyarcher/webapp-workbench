package stockgame.web

import java.sql.SQLException
import javax.sql.DataSource
import org.springframework.beans.factory.ObjectProvider
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

data class HealthBody(val ok: Boolean)

@RestController
class HealthController(private val dataSource: ObjectProvider<DataSource>) {
    @GetMapping("/healthz")
    fun healthz(): HealthBody = HealthBody(ok = true)

    @GetMapping("/readyz")
    fun readyz(): ResponseEntity<HealthBody> {
        val ds = dataSource.ifAvailable
        if (ds == null || !probe(ds)) {
            return ResponseEntity.status(503).body(HealthBody(ok = false))
        }
        return ResponseEntity.ok(HealthBody(ok = true))
    }
}

private fun probe(dataSource: DataSource): Boolean {
    return try {
        dataSource.connection.use { conn ->
            conn.createStatement().use { st ->
                st.executeQuery("SELECT 1").use { rs -> rs.next() }
            }
        }
    } catch (_: SQLException) {
        false
    }
}
