package rssapi.web

import java.time.Instant
import java.util.UUID
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.isUuid
import rssapi.persist.ArticleRepo
import rssapi.persist.ArticleStateEntity
import rssapi.persist.ArticleStateId
import rssapi.persist.ArticleStateRepo
import rssapi.persist.SubscriptionRepo

@RestController
class ArticleWriteController(
    private val user: IdentityUser,
    private val articles: ArticleRepo,
    private val states: ArticleStateRepo,
    private val subs: SubscriptionRepo,
) {
    @PostMapping("/articles/state")
    fun updateState(@RequestBody body: StateListBody): StateResult {
        val updates = body.updates ?: throw ApiException(400, "updates array is required")
        val owned = ownedArticleIds(updates.mapNotNull { it.id })
        var n = 0
        updates.mapNotNull { u ->
            val id = u.id ?: return@mapNotNull null
            if (id !in owned || (u.read == null && u.starred == null)) null
            else {
                upsertState(id, u.read, u.starred)
                1
            }
        }.forEach { n += it }
        return StateResult(updated = n)
    }

    @PostMapping("/articles/read-before")
    fun readBefore(@RequestBody body: ReadBeforeBody): OkBody {
        val cutoff = body.cutoff ?: throw ApiException(400, "cutoff (epoch ms) is required")
        if (body.feedIds != null && body.feedIds.any { !isUuid(it) }) {
            throw ApiException(400, "invalid feed id")
        }
        val ids = body.feedIds?.map { UUID.fromString(it) }
        markRead(cutoffMs = cutoff, feedIds = ids, all = false)
        return OkBody()
    }

    @PostMapping("/articles/read-all")
    fun readAll(@RequestBody body: ReadAllBody?): OkBody {
        val feedId = body?.feedId
        if (feedId != null && !isUuid(feedId)) throw ApiException(400, "invalid feed id")
        markRead(cutoffMs = null, feedIds = feedId?.let { listOf(UUID.fromString(it)) }, all = true)
        return OkBody()
    }

    private fun ownedArticleIds(ids: List<String>): Set<String> {
        if (ids.isEmpty()) return emptySet()
        val userFeeds = subs.findFeedIdsByUserId(user.id).toSet()
        return articles.findAllById(ids).filter { it.feedId in userFeeds }.map { it.id }.toSet()
    }

    private fun upsertState(articleId: String, read: Boolean?, starred: Boolean?) {
        val key = ArticleStateId(user.id, articleId)
        val row = states.findById(key).orElse(ArticleStateEntity(userId = user.id, articleId = articleId))
        if (read != null) {
            row.read = read
            row.readAt = if (read) Instant.now() else null
        }
        if (starred != null) row.starred = starred
        states.save(row)
    }

    private fun markRead(cutoffMs: Long?, feedIds: List<UUID>?, all: Boolean) {
        val userFeeds = subs.findFeedIdsByUserId(user.id)
        val allowed = if (feedIds.isNullOrEmpty()) userFeeds else feedIds.filter { it in userFeeds }
        if (allowed.isEmpty()) return
        articles.findByFeedIdIn(allowed).forEach { article ->
            if (!all && cutoffMs != null && article.publishedAt.toEpochMilli() >= cutoffMs) return@forEach
            upsertState(article.id, read = true, starred = null)
        }
    }
}
