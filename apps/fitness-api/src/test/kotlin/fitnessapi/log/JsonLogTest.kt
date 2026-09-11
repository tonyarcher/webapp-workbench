package fitnessapi.log

import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class JsonLogTest {
    private val now = Instant.parse("2026-09-11T17:00:00.000Z")

    @Test
    fun includesRequiredFields() {
        val line = formatLog("fitness-api", "info", "listening", mapOf("port" to 3003), now = now)!!
        val obj = Json.decodeFromString(JsonObject.serializer(), line)
        assertEquals("2026-09-11T17:00:00.000Z", obj["ts"]?.jsonPrimitive?.content)
        assertEquals("info", obj["level"]?.jsonPrimitive?.content)
        assertEquals("listening", obj["msg"]?.jsonPrimitive?.content)
        assertEquals("fitness-api", obj["service"]?.jsonPrimitive?.content)
        assertEquals("3003", obj["port"]?.jsonPrimitive?.content)
    }

    @Test
    fun dropsDebugWhenMinIsInfo() {
        assertNull(formatLog("fitness-api", "debug", "request", minLevel = "info", now = now))
    }

    @Test
    fun nestsErrObject() {
        val line = formatLog(
            "fitness-api",
            "error",
            "unhandled",
            extra = mapOf("err" to mapOf("type" to "IllegalStateException", "message" to "boom")),
            now = now,
        )!!
        val err = Json.decodeFromString(JsonObject.serializer(), line)["err"]!!.jsonObject
        assertEquals("IllegalStateException", err["type"]?.jsonPrimitive?.content)
        assertEquals("boom", err["message"]?.jsonPrimitive?.content)
        assertTrue("password" !in line)
    }
}
