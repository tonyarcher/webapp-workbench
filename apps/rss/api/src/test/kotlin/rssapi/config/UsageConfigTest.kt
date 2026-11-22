package rssapi.config

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class UsageConfigTest {
    @Test
    fun defaultsToDisabled() {
        assertFalse(usageEnabledFromEnv(emptyMap()).value)
    }

    @Test
    fun enabledWhenFlagSet() {
        assertTrue(usageEnabledFromEnv(mapOf("USAGE_ENABLED" to "1")).value)
    }

    @Test
    fun disabledForOtherValues() {
        assertFalse(usageEnabledFromEnv(mapOf("USAGE_ENABLED" to "true")).value)
    }

    @Test
    fun beanReadsProcessEnv() {
        val enabled = UsageConfig().usageEnabled()
        assertFalse(enabled.value && System.getenv("USAGE_ENABLED") != "1")
    }
}
