package rssapi.persist

import java.time.Instant
import java.util.UUID
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

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
    @Column(name = "content_html")
    var contentHtml: String? = null,
    var comments: Int? = null,
    @Column(name = "published_at")
    var publishedAt: Instant = Instant.now(),
    @Column(name = "fetched_at")
    var fetchedAt: Instant = Instant.now(),
    var popularity: Float = 0f,
    var engagement: Float = 0f,
    var hot: Float = 0f,
)
