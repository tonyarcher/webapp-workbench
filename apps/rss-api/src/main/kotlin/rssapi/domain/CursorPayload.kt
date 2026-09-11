package rssapi.domain

import java.util.Base64
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class CursorPayload(val k: Double, val id: String)

private val JSON = Json { ignoreUnknownKeys = true }

fun encodeCursor(k: Double, id: String): String {
    val json = JSON.encodeToString(CursorPayload.serializer(), CursorPayload(k, id))
    return Base64.getUrlEncoder().withoutPadding().encodeToString(json.toByteArray())
}

fun decodeCursor(encoded: String): CursorPayload? {
    val json = try {
        String(Base64.getUrlDecoder().decode(encoded))
    } catch (_: Exception) {
        return null
    }
    return try {
        JSON.decodeFromString(CursorPayload.serializer(), json)
    } catch (_: Exception) {
        null
    }
}
