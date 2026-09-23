package stockgame.config

import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.ConfigurableApplicationContext
import stockgame.store.BarCache
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class ConfigBranchTest {
    @Test
    fun clockBean() {
        assertNotNull(ClockConfig().clock())
    }

    @Test
    fun databaseConditionMirrorsEnv() {
        val expected = !System.getenv("DATABASE_URL").isNullOrBlank()
        assertEquals(expected, OnDatabaseUrl().matches(mock(), mock()))
    }

    @Test
    fun providerDefaultsYahoo() {
        val cache = mock<ObjectProvider<BarCache>>()
        whenever(cache.ifAvailable).thenReturn(null)
        val provider = ProviderConfig().priceProvider(cache)
        assertEquals("yahoo", provider.id)
    }

    @Test
    fun providerWrapsCache() {
        val cache = mock<ObjectProvider<BarCache>>()
        whenever(cache.ifAvailable).thenReturn(mock())
        val provider = ProviderConfig().priceProvider(cache)
        assertNotNull(provider)
    }

    @Test
    fun readyLogs() {
        val event = mock<ApplicationReadyEvent>()
        val context = mock<ConfigurableApplicationContext>()
        val env = mock<org.springframework.core.env.ConfigurableEnvironment>()
        whenever(event.applicationContext).thenReturn(context)
        whenever(context.environment).thenReturn(env)
        whenever(env.getProperty("local.server.port")).thenReturn(null)
        ReadyLog().onReady(event)
        verify(env).getProperty("local.server.port")
    }

    @Test
    fun readyLogsWithPort() {
        val event = mock<ApplicationReadyEvent>()
        val context = mock<ConfigurableApplicationContext>()
        val env = mock<org.springframework.core.env.ConfigurableEnvironment>()
        whenever(event.applicationContext).thenReturn(context)
        whenever(context.environment).thenReturn(env)
        whenever(env.getProperty("local.server.port")).thenReturn("3005")
        ReadyLog().onReady(event)
        verify(env).getProperty("local.server.port")
    }
}
