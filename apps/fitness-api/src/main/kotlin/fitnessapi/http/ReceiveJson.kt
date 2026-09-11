package fitnessapi.http

import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.contentLength
import io.ktor.server.request.receiveText
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonElement

const val MAX_BODY_BYTES = 2_000_000

suspend fun ApplicationCall.receiveJson(): JsonElement? {
    rejectIfTooLarge(request.contentLength())
    val text = receiveText()
    rejectIfTooLarge(text.length.toLong())
    if (text.isEmpty()) return null
    return parseOrInvalid(text)
}

private fun rejectIfTooLarge(length: Long?) {
    if (length != null && length > MAX_BODY_BYTES) throw ApiError(400, "Request body too large")
}

private fun parseOrInvalid(text: String): JsonElement {
    try {
        return API_JSON.parseToJsonElement(text)
    } catch (_: SerializationException) {
        throw ApiError(400, "Invalid JSON")
    }
}
