package rssapi.articles
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "articles")
class ArticleEntity(
    @Id
    var id: String = "",
    @Column(name = "feed_id", nullable = false)
    var feedId: UUID = UUID(0, 0),
    var guid: String = "",
    var title: String = "",
    var link: String? = null,
    @Column(name = "norm_link")
    var normLink: String? = null,
    var domain: String? = null,
    var author: String? = null,
    var summary: String? = null,
    // Plain-text preview for list/search; body stays in article_bodies.
    var excerpt: String? = null,
    // Full excerpt in the object store, gzip. `excerpt` keeps a bounded head.
    @Column(name = "excerpt_key")
    var excerptKey: String? = null,
    @Column(name = "excerpt_bytes")
    var excerptBytes: Long? = null,
    var image: String? = null,
    @Column(name = "source_kind")
    var sourceKind: String? = null,
    @Column(name = "connector_id")
    var connectorId: String? = null,
    @Column(name = "connector_version")
    var connectorVersion: String? = null,
    @Column(name = "canonical_url")
    var canonicalUrl: String? = null,
    @Column(name = "source_url")
    var sourceUrl: String? = null,
    @Column(name = "fetch_mode")
    var fetchMode: String? = null,
    var comments: Int? = null,
    @Column(name = "published_at")
    var publishedAt: Instant = Instant.now(),
    @Column(name = "fetched_at")
    var fetchedAt: Instant = Instant.now(),
    @Column(name = "topics_extracted_at")
    var topicsExtractedAt: Instant? = null,
    @Column(name = "evidence_extracted_at")
    var evidenceExtractedAt: Instant? = null,
    var popularity: Float = 0f,
    var engagement: Float = 0f,
    var hot: Float = 0f,
) {
    /**
     * A newer local excerpt invalidates the store pointer, so the offload pass
     * re-uploads the full text instead of serving the older object.
     */
    fun replaceExcerpt(text: String?) {
        excerpt = text
        excerptKey = null
        excerptBytes = null
    }
}
