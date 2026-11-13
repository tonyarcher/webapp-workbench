package rssapi.persist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "saved_articles")
class SavedArticleEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(name = "user_id", nullable = false)
    var userId: UUID = UUID(0, 0),
    @Column(name = "article_id")
    var articleId: String? = null,
    @Column(name = "feed_id")
    var feedId: UUID? = null,
    @Column(name = "feed_title")
    var feedTitle: String? = null,
    var title: String = "",
    var link: String? = null,
    var author: String? = null,
    var summary: String? = null,
    @Column(name = "content_html")
    var contentHtml: String? = null,
    @Column(name = "published_at")
    var publishedAt: Instant? = null,
    @Column(name = "saved_at", nullable = false)
    var savedAt: Instant = Instant.now(),
)
