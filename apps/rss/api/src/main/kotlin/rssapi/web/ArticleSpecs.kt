package rssapi.web

import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.CriteriaQuery
import jakarta.persistence.criteria.Root
import jakarta.persistence.criteria.Subquery
import org.springframework.data.jpa.domain.Specification
import rssapi.domain.ArticleScope
import rssapi.domain.ArticleSort
import rssapi.domain.CursorPayload
import rssapi.domain.ParsedSearchQuery
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleStateEntity
import rssapi.persist.FeedEntity
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedEntity
import rssapi.persist.SubscriptionEntity
import java.time.Instant
import java.util.UUID

fun articleSpec(
    userId: UUID,
    scope: ArticleScope,
    unreadOnly: Boolean,
    sort: ArticleSort,
    cursor: CursorPayload?,
    sinceMs: Long?,
    search: ParsedSearchQuery? = null,
): Specification<ArticleEntity> = Specification { root, query, cb ->
    val parts = mutableListOf(
        scopePredicate(userId, scope, root, query, cb),
    )
    if (unreadOnly) parts.add(unreadPredicate(userId, root, query, cb))
    if (sinceMs != null) {
        parts.add(cb.greaterThanOrEqualTo(root.get("publishedAt"), Instant.ofEpochMilli(sinceMs)))
    }
    searchPredicate(search, userId, root, query, cb)?.let { parts.add(it) }
    operatorPredicates(search?.operators, userId, root, query, cb).forEach { parts.add(it) }
    cursorPredicate(sort, cursor, root, cb)?.let { parts.add(it) }
    cb.and(*parts.toTypedArray())
}

private fun scopePredicate(
    userId: UUID,
    scope: ArticleScope,
    root: Root<ArticleEntity>,
    query: CriteriaQuery<*>,
    cb: CriteriaBuilder,
) = when (scope) {
    is ArticleScope.All -> root.get<UUID>("feedId").`in`(userFeedSub(userId, query, cb))

    is ArticleScope.Feed -> cb.and(
        cb.equal(root.get<UUID>("feedId"), scope.id),
        root.get<UUID>("feedId").`in`(userFeedSub(userId, query, cb)),
    )

    is ArticleScope.Folder -> root.get<UUID>("feedId").`in`(folderFeedSub(userId, scope.id, query, cb))
}

private fun userFeedSub(userId: UUID, query: CriteriaQuery<*>, cb: CriteriaBuilder): Subquery<UUID> {
    val sub = query.subquery(UUID::class.java)
    val subscription = sub.from(SubscriptionEntity::class.java)
    sub.select(subscription.get("feedId"))
    sub.where(cb.equal(subscription.get<UUID>("userId"), userId))
    return sub
}

private fun folderFeedSub(userId: UUID, folderId: UUID, query: CriteriaQuery<*>, cb: CriteriaBuilder): Subquery<UUID> {
    val sub = query.subquery(UUID::class.java)
    val ff = sub.from(FolderFeedEntity::class.java)
    val folder = sub.from(rssapi.persist.FolderEntity::class.java)
    sub.select(ff.get("feedId"))
    sub.where(
        cb.equal(ff.get<UUID>("folderId"), folderId),
        cb.equal(folder.get<UUID>("id"), folderId),
        cb.equal(folder.get<UUID>("userId"), userId),
    )
    return sub
}

private fun unreadPredicate(
    userId: UUID,
    root: Root<ArticleEntity>,
    query: CriteriaQuery<*>,
    cb: CriteriaBuilder,
): jakarta.persistence.criteria.Predicate {
    val sub = query.subquery(Long::class.java)
    val state = sub.from(ArticleStateEntity::class.java)
    sub.select(cb.literal(1L))
    sub.where(
        cb.equal(state.get<String>("articleId"), root.get<String>("id")),
        cb.equal(state.get<UUID>("userId"), userId),
        cb.isTrue(state.get("read")),
    )
    return cb.not(cb.exists(sub))
}

private fun searchPredicate(
    search: ParsedSearchQuery?,
    userId: UUID,
    root: Root<ArticleEntity>,
    query: CriteriaQuery<*>,
    cb: CriteriaBuilder,
): jakarta.persistence.criteria.Predicate? {
    val tokens = search?.tokens ?: return null
    if (tokens.isEmpty()) return null
    val tokenPredicates = tokens.map { token ->
        val pattern = likeContains(token)
        cb.or(
            cb.like(cb.lower(cb.coalesce(root.get("title"), "")), pattern, '\\'),
            cb.like(cb.lower(cb.coalesce(root.get("summary"), "")), pattern, '\\'),
            cb.like(cb.lower(cb.coalesce(root.get("contentHtml"), "")), pattern, '\\'),
            cb.like(cb.lower(cb.coalesce(root.get("author"), "")), pattern, '\\'),
            cb.like(cb.lower(cb.coalesce(root.get("domain"), "")), pattern, '\\'),
            cb.like(cb.lower(cb.coalesce(root.get("link"), "")), pattern, '\\'),
            feedTitleMatches(token, root, query, cb),
        )
    }
    return cb.and(*tokenPredicates.toTypedArray())
}

private fun feedTitleMatches(
    token: String,
    root: Root<ArticleEntity>,
    query: CriteriaQuery<*>,
    cb: CriteriaBuilder,
): jakarta.persistence.criteria.Predicate {
    val sub = query.subquery(Long::class.java)
    val feed = sub.from(FeedEntity::class.java)
    sub.select(cb.literal(1L))
    sub.where(
        cb.equal(feed.get<UUID>("id"), root.get<UUID>("feedId")),
        cb.like(cb.lower(cb.coalesce(feed.get("title"), "")), likeContains(token), '\\'),
    )
    return cb.exists(sub)
}

private fun likeContains(term: String): String =
    "%${term.lowercase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")}%"

private fun operatorPredicates(
    ops: rssapi.domain.SearchOperators?,
    userId: UUID,
    root: Root<ArticleEntity>,
    query: CriteriaQuery<*>,
    cb: CriteriaBuilder,
): List<jakarta.persistence.criteria.Predicate> {
    if (ops == null) return emptyList()
    val out = mutableListOf<jakarta.persistence.criteria.Predicate>()
    ops.afterMs?.let {
        out.add(cb.greaterThanOrEqualTo(root.get("publishedAt"), Instant.ofEpochMilli(it)))
    }
    ops.beforeMs?.let {
        out.add(cb.lessThanOrEqualTo(root.get("publishedAt"), Instant.ofEpochMilli(it)))
    }
    for (term in ops.authors) {
        out.add(cb.like(cb.lower(cb.coalesce(root.get("author"), "")), likeContains(term), '\\'))
    }
    for (term in ops.feeds) {
        val sub = query.subquery(Long::class.java)
        val feed = sub.from(FeedEntity::class.java)
        val subr = sub.from(SubscriptionEntity::class.java)
        sub.select(cb.literal(1L))
        sub.where(
            cb.equal(feed.get<UUID>("id"), root.get<UUID>("feedId")),
            cb.equal(subr.get<UUID>("feedId"), root.get<UUID>("feedId")),
            cb.equal(subr.get<UUID>("userId"), userId),
            cb.like(cb.lower(cb.coalesce(feed.get("title"), "")), likeContains(term), '\\'),
        )
        out.add(cb.exists(sub))
    }
    for (term in ops.folders) {
        val sub = query.subquery(Long::class.java)
        val ff = sub.from(FolderFeedEntity::class.java)
        val folder = sub.from(FolderEntity::class.java)
        val subr = sub.from(SubscriptionEntity::class.java)
        sub.select(cb.literal(1L))
        sub.where(
            cb.equal(ff.get<UUID>("feedId"), root.get<UUID>("feedId")),
            cb.equal(ff.get<UUID>("folderId"), folder.get<UUID>("id")),
            cb.equal(folder.get<UUID>("userId"), userId),
            cb.equal(subr.get<UUID>("feedId"), root.get<UUID>("feedId")),
            cb.equal(subr.get<UUID>("userId"), userId),
            cb.like(cb.lower(cb.coalesce(folder.get("title"), "")), likeContains(term), '\\'),
        )
        out.add(cb.exists(sub))
    }
    if (ops.isStarred == true) out.add(starredPredicate(userId, root, query, cb, true))
    if (ops.isUnread == true) out.add(unreadPredicate(userId, root, query, cb))
    if (ops.isRead == true) out.add(starredPredicate(userId, root, query, cb, null, read = true))
    // hasVideo/minReadMinutes not enforceable server-side (no columns); client refines.
    return out
}

private fun starredPredicate(
    userId: UUID,
    root: Root<ArticleEntity>,
    query: CriteriaQuery<*>,
    cb: CriteriaBuilder,
    starred: Boolean? = null,
    read: Boolean? = null,
): jakarta.persistence.criteria.Predicate {
    val sub = query.subquery(Long::class.java)
    val state = sub.from(ArticleStateEntity::class.java)
    sub.select(cb.literal(1L))
    val conds = mutableListOf(
        cb.equal(state.get<UUID>("userId"), userId),
        cb.equal(state.get<String>("articleId"), root.get<String>("id")),
    )
    if (starred != null) conds.add(cb.equal(state.get<Boolean>("starred"), starred))
    if (read != null) conds.add(cb.equal(state.get<Boolean>("read"), read))
    sub.where(*conds.toTypedArray())
    return cb.exists(sub)
}

private fun cursorPredicate(
    sort: ArticleSort,
    cursor: CursorPayload?,
    root: Root<ArticleEntity>,
    cb: CriteriaBuilder,
): jakarta.persistence.criteria.Predicate? {
    if (cursor == null) return null
    if (sort == ArticleSort.HOT) {
        return cb.or(
            cb.lessThan(root.get("hot"), cursor.k.toFloat()),
            cb.and(
                cb.equal(root.get<Float>("hot"), cursor.k.toFloat()),
                cb.lessThan(root.get("id"), cursor.id),
            ),
        )
    }
    val at = Instant.ofEpochMilli(cursor.k.toLong())
    val pub = root.get<Instant>("publishedAt")
    return if (sort == ArticleSort.OLDEST) {
        cb.or(
            cb.greaterThan(pub, at),
            cb.and(cb.equal(pub, at), cb.greaterThan(root.get("id"), cursor.id)),
        )
    } else {
        cb.or(
            cb.lessThan(pub, at),
            cb.and(cb.equal(pub, at), cb.lessThan(root.get("id"), cursor.id)),
        )
    }
}
