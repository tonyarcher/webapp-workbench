package fitnessapi.config

import kotlin.test.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.core.env.ConfigurableEnvironment

private typealias ReadyMocks = Triple<ApplicationReadyEvent, ConfigurableApplicationContext, ConfigurableEnvironment>

class ReadyLogBranchTest {
    private fun event(port: String?): ReadyMocks {
        val ready = mock<ApplicationReadyEvent>()
        val context = mock<ConfigurableApplicationContext>()
        val env = mock<ConfigurableEnvironment>()
        whenever(ready.applicationContext).thenReturn(context)
        whenever(context.environment).thenReturn(env)
        whenever(env.getProperty("local.server.port")).thenReturn(port)
        return Triple(ready, context, env)
    }

    @Test
    fun onReadyWithPort() {
        val (ready, _, env) = event("3003")
        ReadyLog().onReady(ready)
        verify(env).getProperty("local.server.port")
    }

    @Test
    fun onReadyWithoutPort() {
        val (ready, _, env) = event(null)
        ReadyLog().onReady(ready)
        verify(env).getProperty("local.server.port")
    }
}
