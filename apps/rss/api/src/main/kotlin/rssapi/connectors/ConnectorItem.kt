package rssapi.connectors

/** Normalized item produced by any connector. */
data class ConnectorItem(
    val guid: String,
    val title: String,
    val link: String?,
    val summary: String?,
    val content: String?,
    val published: Long,
    val media: String?,
    val comments: Int?,
)
