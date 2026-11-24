package timesupapi.articles
import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import timesupapi.feeds.OkBody
import timesupapi.feeds.SubscriptionRepo
import timesupapi.platform.ApiException
import timesupapi.platform.IdentityUser
import timesupapi.platform.isUuid
import java.time.Instant
import java.util.UUID

internal const val MAX_STATE_UPDATES: Int = 500

@RestController
class ArticleWriteController(
    private val user: IdentityUser,
    private val articles: ArticleRepo,
    private val states: ArticleStateRepo,
    private val subs: SubscriptionRepo,
) {
    @PostMapping("/articles/state", headers = ["X-Api-Version=1"])
    @Transactional
    fun updateState(@RequestBody body: StateListBody): StateResult {
        val updates = body.updates ?: throw ApiException(HttpStatus.BAD_REQUEST, "updates array is required")
        if (updates.size > MAX_STATE_UPDATES) throw ApiException(HttpStatus.BAD_REQUEST, "too many updates")
        val latest = updates.filter { it.id != null && (it.read != null || it.starred != null) }
            .associate { it.id!! to it }
        val owned = ownedArticleIds(latest.keys)
        val candidates = latest.values.filter { it.id in owned }
        val keys = candidates.map { ArticleStateId(user.id, it.id!!) }
        val existing = states.findAllById(keys).associateBy { it.articleId }
        val rows = candidates.map { stateRow(it.id!!, it.read, it.starred, existing[it.id]) }
        states.saveAll(rows)
        return StateResult(updated = rows.size)
    }

    @PostMapping("/articles/read-before", headers = ["X-Api-Version=1"])
    @Transactional
    fun readBefore(@RequestBody body: ReadBeforeBody): OkBody {
        val cutoff = body.cutoff ?: throw ApiException(HttpStatus.BAD_REQUEST, "cutoff (epoch ms) is required")
        if (body.feedIds != null && body.feedIds.any { !isUuid(it) }) {
            throw ApiException(HttpStatus.BAD_REQUEST, "invalid feed id")
        }
        val ids = body.feedIds?.map { UUID.fromString(it) }
        markRead(feedIds = ids, cutoff = Instant.ofEpochMilli(cutoff))
        return OkBody()
    }

    @PostMapping("/articles/read-all", headers = ["X-Api-Version=1"])
    @Transactional
    fun readAll(@RequestBody body: ReadAllBody?): OkBody {
        val feedId = body?.feedId
        if (feedId != null && !isUuid(feedId)) throw ApiException(HttpStatus.BAD_REQUEST, "invalid feed id")
        markRead(feedIds = feedId?.let { listOf(UUID.fromString(it)) }, cutoff = null)
        return OkBody()
    }

    private fun ownedArticleIds(ids: Collection<String>): Set<String> {
        if (ids.isEmpty()) return emptySet()
        val userFeeds = subs.findFeedIdsByUserId(user.id).toSet()
        return articles.findFeedIdsByIdIn(ids).filter { it.feedId in userFeeds }.map { it.id }.toSet()
    }

    private fun stateRow(
        articleId: String,
        read: Boolean?,
        starred: Boolean?,
        existing: ArticleStateEntity?,
    ): ArticleStateEntity {
        val row = existing ?: ArticleStateEntity(userId = user.id, articleId = articleId)
        if (read != null) {
            row.read = read
            row.readAt = if (read) Instant.now() else null
        }
        if (starred != null) row.starred = starred
        return row
    }

    private fun markRead(feedIds: List<UUID>?, cutoff: Instant?) {
        val userFeeds = subs.findFeedIdsByUserId(user.id)
        val allowed = if (feedIds.isNullOrEmpty()) userFeeds else feedIds.filter { it in userFeeds }
        if (allowed.isEmpty()) return
        if (cutoff == null) {
            states.markReadAll(user.id, allowed)
        } else {
            states.markReadBefore(user.id, allowed, cutoff)
        }
    }
}
