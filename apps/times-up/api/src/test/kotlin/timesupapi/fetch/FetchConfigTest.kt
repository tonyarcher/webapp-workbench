package timesupapi.fetch

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FetchConfigTest {
    @Test
    fun newEnvironmentKeyEnablesLocalFetch() {
        assertTrue(allowLocalFetchFromEnv(mapOf("TIMES_UP_ALLOW_LOCAL_FETCH" to "1")))
    }

    @Test
    fun legacyEnvironmentKeyRemainsAccepted() {
        assertTrue(allowLocalFetchFromEnv(mapOf("RSS_ALLOW_LOCAL_FETCH" to "1")))
    }

    @Test
    fun newEnvironmentKeyWinsOverLegacy() {
        assertFalse(allowLocalFetchFromEnv(mapOf("TIMES_UP_ALLOW_LOCAL_FETCH" to "0", "RSS_ALLOW_LOCAL_FETCH" to "1")))
    }

    @Test
    fun localFetchDefaultsOff() {
        assertFalse(allowLocalFetchFromEnv(emptyMap()))
    }
}
