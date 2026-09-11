package userapi.http

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.response.respond

suspend fun ApplicationCall.receivePasswordBody(): PasswordBody? {
    return try {
        receive<PasswordBody>()
    } catch (_: Exception) {
        respond(HttpStatusCode.BadRequest, ErrBody(ErrDetail("validation", "invalid json")))
        null
    }
}

suspend fun ApplicationCall.rejectRate() {
    respond(HttpStatusCode.TooManyRequests, ErrBody(ErrDetail("rate", "too many attempts")))
}

suspend fun ApplicationCall.rejectAuth() {
    respond(HttpStatusCode.Unauthorized, ErrBody(ErrDetail("unauthorized", "invalid credentials")))
}

fun ApplicationCall.clientIp(): String {
    val real = request.headers["X-Real-IP"]?.trim().orEmpty()
    if (real.isNotBlank()) return real.take(64)
    return request.local.remoteAddress.take(64)
}
