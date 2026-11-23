package rssapi.connectors

/** Capability flags for a connector. */
data class ConnectorCapabilities(
    val supportsPush: Boolean = false,
    val supportsAuth: Boolean = false,
    val supportsIncremental: Boolean = true,
    val bestEffort: Boolean = true,
)
