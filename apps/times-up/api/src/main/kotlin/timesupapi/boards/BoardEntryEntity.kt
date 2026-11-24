package timesupapi.boards
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/** One pinned row on a board. A snapshot, like saved_articles: the board keeps
 *  its copy even if the feed or article later changes or disappears. */
@Entity
@Table(name = "board_entries")
class BoardEntryEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(name = "board_id", nullable = false)
    var boardId: UUID = UUID(0, 0),
    @Column(name = "article_id", nullable = false)
    var articleId: String = "",
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
    var note: String = "",
    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,
    @Column(name = "added_at")
    var addedAt: Instant = Instant.now(),
)
