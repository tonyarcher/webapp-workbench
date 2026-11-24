package timesupapi.provenance

/** One evidence slice. The id is stable, so other features can link to it. */
data class EvidenceJson(val id: String, val articleId: String, val kind: String, val text: String)

/** The row a piece of evidence rests on, including its P12 connector provenance. */
data class SourceRowJson(
    val articleId: String,
    val feedId: String,
    val feedTitle: String,
    val sourceKind: String?,
    val connectorId: String?,
    val connectorVersion: String?,
    val fetchMode: String?,
    val canonicalUrl: String?,
    val sourceUrl: String?,
    val fetchedAt: Long,
)

data class ArticleProvenanceJson(
    val articleId: String,
    val source: SourceRowJson,
    val quotes: List<EvidenceJson> = emptyList(),
    val figures: List<EvidenceJson> = emptyList(),
)
