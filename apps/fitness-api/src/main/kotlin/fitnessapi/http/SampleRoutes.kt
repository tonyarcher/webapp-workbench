package fitnessapi.http

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import fitnessapi.LOCAL_USER_ID
import fitnessapi.store.FitnessServices

fun Application.sampleRoutes(fitness: FitnessServices) {
    routing {
        get("/stats") { getStats(call, fitness) }
        get("/samples/latest") { getLatest(call, fitness) }
        get("/samples") { getSamples(call, fitness) }
        get("/series") { getSeries(call, fitness) }
        get("/rollups") { getRollups(call, fitness) }
    }
}

private suspend fun getStats(call: ApplicationCall, fitness: FitnessServices) {
    val store = call.requireSamples(fitness) ?: return
    call.respond(StatsJson(store.stats(LOCAL_USER_ID).map { it.toJson() }))
}

private suspend fun getLatest(call: ApplicationCall, fitness: FitnessServices) {
    val store = call.requireSamples(fitness) ?: return
    call.respond(LatestJson(store.latest(LOCAL_USER_ID).map { it.toJson() }))
}

private suspend fun getSamples(call: ApplicationCall, fitness: FitnessServices) {
    val store = call.requireSamples(fitness) ?: return
    val (from, to) = call.timeRange(fitness.clock)
    val rows = store.listSamples(
        LOCAL_USER_ID,
        call.request.queryParameters["metric"],
        from,
        to,
        call.limitParam(),
    )
    call.respond(SamplesJson(rows.map { it.toJson() }))
}

private suspend fun getRollups(call: ApplicationCall, fitness: FitnessServices) {
    val store = call.requireSamples(fitness) ?: return
    call.respond(RollupsJson(store.rollups(LOCAL_USER_ID).map { it.toJson() }))
}
