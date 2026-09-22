package radioapi

import kotlin.test.Test
import kotlin.test.assertEquals

class SettingsTest {
    @Test
    fun defaults() {
        val settings = settingsFromEnv(emptyMap())
        assertEquals(3002, settings.port)
        assertEquals("radio-api", settings.service)
        assertEquals("", settings.databaseUrl)
        assertEquals(9, settingsFromEnv(mapOf("PORT" to "9", "SERVICE" to " ", "LOG_LEVEL" to "warn")).port)
        assertEquals("custom", settingsFromEnv(mapOf("SERVICE" to "custom")).service)
    }
}
