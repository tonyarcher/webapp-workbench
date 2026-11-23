package rssapi.connectors
import java.time.Instant

/** What a user sees in the source-info view. */
data class SourceInfo(
    val feedId: String,
    val connectorId: String?,
    val connectorVersion: String?,
    val sourceKind: String,
    val lastRunAt: Instant?,
    val lastError: String?,
    val capabilities: ConnectorCapabilities,
)
