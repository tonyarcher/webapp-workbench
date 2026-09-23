package radioapi.log

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

private val RANK = mapOf("debug" to 10, "info" to 20, "warn" to 30, "error" to 40)

/** Rank given to a level string RANK does not know: quietest-but-emitting. */
private const val UNKNOWN_LEVEL_RANK = 20
private val TS: DateTimeFormatter =
    DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)

fun parseLogLevel(raw: String): String {
    val name = raw.lowercase()
    return if (name in RANK) name else "info"
}

fun formatLog(
    service: String,
    level: String,
    msg: String,
    extra: Map<String, Any?> = emptyMap(),
    minLevel: String = "info",
    now: Instant = Instant.now(),
): String? {
    val parsed = parseLogLevel(level)
    if ((RANK[parsed] ?: UNKNOWN_LEVEL_RANK) < (RANK[parseLogLevel(minLevel)] ?: UNKNOWN_LEVEL_RANK)) return null
    val body = buildJsonObject {
        put("ts", TS.format(now))
        put("level", parsed)
        put("msg", msg)
        put("service", service)
        extra.forEach { (key, value) -> if (value != null) put(key, jsonValue(value)) }
    }
    return Json.encodeToString(JsonObject.serializer(), body)
}

fun log(
    service: String,
    level: String,
    msg: String,
    extra: Map<String, Any?> = emptyMap(),
    minLevel: String = parseLogLevel(System.getenv("LOG_LEVEL") ?: "info"),
) {
    val line = formatLog(service, level, msg, extra, minLevel) ?: return
    val sink = if (level == "warn" || level == "error") System.err else System.out
    sink.println(line)
}

private fun jsonValue(value: Any): JsonElement {
    if (value is Map<*, *>) return nested(value)
    return scalar(value)
}

private fun nested(value: Map<*, *>): JsonObject = buildJsonObject {
    value.forEach { (key, item) -> if (key is String && item != null) put(key, scalar(item)) }
}

private fun scalar(value: Any): JsonPrimitive = when (value) {
    is Boolean -> JsonPrimitive(value)
    is Number -> JsonPrimitive(value)
    else -> JsonPrimitive(value.toString())
}
