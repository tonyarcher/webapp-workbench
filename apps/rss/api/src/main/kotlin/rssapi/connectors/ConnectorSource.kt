package rssapi.connectors

/** One configured source, independent of the connector implementation. */
data class ConnectorSource(
    val id: String,
    val kind: String,
    val connectorId: String,
    val canonicalUrl: String?,
    val sourceUrl: String?,
    val fetchMode: String?,
)
