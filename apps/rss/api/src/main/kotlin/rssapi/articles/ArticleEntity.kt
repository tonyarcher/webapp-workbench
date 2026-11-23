package rssapi.articles
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
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
    var popularity: Float = 0f,
    var engagement: Float = 0f,
    var hot: Float = 0f,
    // Generated in V15; the application never writes this column.
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "search_text", insertable = false, updatable = false)
    var searchText: String? = null,
)
