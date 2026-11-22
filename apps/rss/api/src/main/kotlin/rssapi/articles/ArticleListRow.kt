package rssapi.articles
import java.time.Instant
import java.util.UUID

/** List-read projection: never carries the body column. */
data class ArticleListRow(
    val id: String,
    val feedId: UUID,
    val guid: String,
    val title: String,
    val link: String?,
    val normLink: String?,
    val domain: String?,
    val author: String?,
    val summary: String?,
    val excerpt: String?,
    val image: String?,
    val comments: Int?,
    val publishedAt: Instant,
    val fetchedAt: Instant,
    val popularity: Float,
    val engagement: Float,
    val hot: Float,
)
