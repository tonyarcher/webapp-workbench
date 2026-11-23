package rssapi.connectors
import rssapi.feeds.FeedEntity

/** Shared contract for every source type. */
interface Connector {
    val id: String
    val version: String
    val capabilities: ConnectorCapabilities

    fun source(feed: FeedEntity): ConnectorSource

    fun fetch(source: ConnectorSource): List<ConnectorItem>
}
