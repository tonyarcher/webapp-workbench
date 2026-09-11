package fitnessapi.http

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.put
import io.ktor.server.routing.routing
import kotlinx.serialization.json.JsonObject
import fitnessapi.LOCAL_USER_ID
import fitnessapi.domain.parseProfile
import fitnessapi.store.FitnessServices

fun Application.profileRoutes(fitness: FitnessServices) {
    routing {
        get("/profile") { getProfile(call, fitness) }
        put("/profile") { putProfile(call, fitness) }
    }
}

private suspend fun getProfile(call: ApplicationCall, fitness: FitnessServices) {
    val store = call.requireProfiles(fitness) ?: return
    call.respond(store.getProfile(LOCAL_USER_ID).toJson())
}

private suspend fun putProfile(call: ApplicationCall, fitness: FitnessServices) {
    val store = call.requireProfiles(fitness) ?: return
    val body = call.receiveJson() as? JsonObject ?: throw ApiError(400, "missing body")
    val tm = body["tm"] as? JsonObject
    val profile = parseProfile(
        sex = body.string("sex"),
        birthYear = body.jsonNumber("birthYear"),
        heightM = body.jsonNumber("heightM"),
        displayUnit = body.string("displayUnit"),
        squat = tm?.jsonNumber("squat"),
        bench = tm?.jsonNumber("bench"),
        deadlift = tm?.jsonNumber("deadlift"),
        press = tm?.jsonNumber("press"),
    )
    call.respond(store.putProfile(LOCAL_USER_ID, profile).toJson())
}
