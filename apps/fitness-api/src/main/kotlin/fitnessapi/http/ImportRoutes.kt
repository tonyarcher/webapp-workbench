package fitnessapi.http

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import fitnessapi.LOCAL_USER_ID
import fitnessapi.domain.MAX_IMPORT_ROWS
import fitnessapi.domain.asSample
import fitnessapi.domain.collectSamples
import fitnessapi.domain.sampleSource
import fitnessapi.store.FitnessServices

fun Application.importRoutes(fitness: FitnessServices) {
    routing {
        post("/imports") { postImport(call, fitness) }
    }
}

private suspend fun postImport(call: ApplicationCall, fitness: FitnessServices) {
    val store = call.requireSamples(fitness) ?: return
    val body = call.receiveJson() as? JsonObject
    val raw = body?.get("samples") as? JsonArray ?: JsonArray(emptyList())
    if (raw.size > MAX_IMPORT_ROWS) {
        throw ApiError(400, "at most $MAX_IMPORT_ROWS samples per request")
    }
    val collected = collectSamples(raw.map { parseIncoming(it as? JsonObject) })
    val result = store.importSamples(
        LOCAL_USER_ID,
        collected.samples,
        sampleSource(body?.string("source")),
        collected.errorCount,
        collected.errors,
    )
    call.respond(ImportJson(result.importId, result.stored, result.skipped, result.errors))
}

private fun parseIncoming(obj: JsonObject?) = asSample(
    metricRaw = obj?.string("metric"),
    t = obj?.numberLike("t"),
    valueSi = obj?.numberLike("valueSi"),
    source = obj?.string("source"),
    originId = obj?.string("originId"),
)
