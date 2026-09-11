package fitnessapi.http

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import java.sql.Connection
import javax.sql.DataSource

fun Application.healthRoutes(dataSource: DataSource?) {
    routing {
        get("/healthz") {
            call.respond(HealthBody(ok = true))
        }
        get("/readyz") {
            if (dataSource == null || !probe(dataSource)) {
                call.respond(HttpStatusCode.ServiceUnavailable, HealthBody(ok = false))
                return@get
            }
            call.respond(HealthBody(ok = true))
        }
    }
}

internal fun probe(dataSource: DataSource): Boolean {
    return try {
        dataSource.connection.use { conn -> selectOne(conn) }
    } catch (_: Exception) {
        false
    }
}

private fun selectOne(conn: Connection): Boolean {
    conn.createStatement().use { st ->
        st.executeQuery("SELECT 1").use { rs -> return rs.next() }
    }
}
