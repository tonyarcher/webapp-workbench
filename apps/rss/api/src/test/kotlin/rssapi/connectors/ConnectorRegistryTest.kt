package rssapi.connectors
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.support.StaticListableBeanFactory

class ConnectorRegistryTest {
    private val connector = object : Connector {
        override val id = "rss"
        override val version = "1"
        override val capabilities = ConnectorCapabilities()
        override fun source(feed: rssapi.feeds.FeedEntity) = ConnectorSource("f", "rss", "rss", null, null, "poll")
        override fun fetch(source: ConnectorSource): List<ConnectorItem> = emptyList()
    }

    @Test
    fun looksUpAndListsConnectors() {
        val registry = registryOf(connector)
        assertEquals("rss", registry.get("rss").id)
        assertEquals(listOf("rss"), registry.ids())
        assertThrows<IllegalArgumentException> { registry.get("missing") }
    }

    /** No connector bean exists yet, so context startup must tolerate an empty registry. */
    @Test
    fun emptyRegistryIsLegal() {
        val registry = registryOf()
        assertTrue(registry.ids().isEmpty())
        assertNull(registry.getOrNull("rss"))
        assertThrows<IllegalArgumentException> { registry.get("rss") }
    }

    private fun registryOf(vararg connectors: Connector): ConnectorRegistry {
        val factory = StaticListableBeanFactory()
        connectors.forEach { factory.addBean(it.id, it) }
        return ConnectorRegistry(factory.getBeanProvider(Connector::class.java))
    }
}
