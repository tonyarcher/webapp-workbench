package fitnessapi.http

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import fitnessapi.store.FitnessServices
import fitnessapi.store.ProfileStore
import fitnessapi.store.SampleStore

suspend fun ApplicationCall.requireProfiles(fitness: FitnessServices): ProfileStore? {
    val store = fitness.profiles
    if (store != null) return store
    respond(HttpStatusCode.ServiceUnavailable, ErrorBody("database offline"))
    return null
}

suspend fun ApplicationCall.requireSamples(fitness: FitnessServices): SampleStore? {
    val store = fitness.samples
    if (store != null) return store
    respond(HttpStatusCode.ServiceUnavailable, ErrorBody("database offline"))
    return null
}
