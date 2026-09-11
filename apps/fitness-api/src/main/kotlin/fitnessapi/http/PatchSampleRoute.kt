package fitnessapi.http

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.server.routing.patch
import io.ktor.server.routing.routing
import kotlinx.serialization.json.JsonObject
import fitnessapi.LOCAL_USER_ID
import fitnessapi.store.FitnessServices
import fitnessapi.store.SampleStore
import fitnessapi.store.StoredSample

fun Application.patchSampleRoute(fitness: FitnessServices) {
    routing {
        patch("/samples") { patchSample(call, fitness) }
    }
}

private suspend fun patchSample(call: ApplicationCall, fitness: FitnessServices) {
    val store = call.requireSamples(fitness) ?: return
    val body = call.receiveJson() as? JsonObject
    val metric = body?.string("metric")
    val originId = body?.string("originId")
    if (metric == null || originId == null) throw ApiError(400, "metric and originId required")
    val row = store.findByOrigin(LOCAL_USER_ID, metric, originId)
        ?: throw ApiError(404, "sample not found")
    val note = body.string("note")
    applyPatch(call, store, row, body.jsonNumber("valueSi"), body.bool("hidden") == true, note)
}

private suspend fun applyPatch(
    call: ApplicationCall,
    store: SampleStore,
    row: StoredSample,
    valueSi: Double?,
    hidden: Boolean,
    note: String?,
) {
    if (valueSi != null) {
        if (!valueSi.isFinite()) throw ApiError(400, "valueSi must be finite")
        store.applyOverride(LOCAL_USER_ID, row, valueSi, note)
        call.respond(OkOverridden(ok = true, overridden = true))
        return
    }
    if (hidden) {
        store.hideSample(LOCAL_USER_ID, row, note)
        call.respond(OkHidden(ok = true, hidden = true))
        return
    }
    throw ApiError(400, "valueSi or hidden required")
}
