package rssapi.web

import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.CriteriaQuery
import jakarta.persistence.criteria.Predicate
import jakarta.persistence.criteria.Root
import rssapi.domain.SearchOperators
import rssapi.persist.ArticleEntity
import rssapi.persist.ArticleStateEntity
import rssapi.persist.FeedEntity
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedEntity
import rssapi.persist.SubscriptionEntity
import java.time.Instant
import java.util.UUID

internal fun operatorPredicates(
    ops: SearchOperators?,
    userId: UUID,
    root: Root<ArticleEntity>,
    query: CriteriaQuery<*>,
    cb: CriteriaBuilder,
): List<Predicate> {
    if (ops == null) return emptyList()
    return buildList {
        addAll(datePredicates(ops, root, cb))
        addAll(authorPredicates(ops, root, cb))
        addAll(feedPredicates(ops, userId, root, query, cb))
        addAll(folderPredicates(ops, userId, root, query, cb))
        addAll(flagPredicates(ops, userId, root, query, cb))
    }
}

private fun datePredicates(ops: SearchOperators, root: Root<ArticleEntity>, cb: CriteriaBuilder): List<Predicate> =
    listOfNotNull(
        ops.afterMs?.let { cb.greaterThanOrEqualTo(root.get("publishedAt"), Instant.ofEpochMilli(it)) },
        ops.beforeMs?.let { cb.lessThanOrEqualTo(root.get("publishedAt"), Instant.ofEpochMilli(it)) },
    )

private fun authorPredicates(ops: SearchOperators, root: Root<ArticleEntity>, cb: CriteriaBuilder): List<Predicate> =
    ops.authors.map { term ->
        cb.like(cb.lower(cb.coalesce(root.get("author"), "")), likeContains(term), '\\')
    }

private fun feedPredicates(
    ops: SearchOperators,
    userId: UUID,
    root: Root<ArticleEntity>,
    query: CriteriaQuery<*>,
    cb: CriteriaBuilder,
): List<Predicate> = ops.feeds.map { term ->
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
    cb.exists(sub)
}

private fun folderPredicates(
    ops: SearchOperators,
    userId: UUID,
    root: Root<ArticleEntity>,
    query: CriteriaQuery<*>,
    cb: CriteriaBuilder,
): List<Predicate> = ops.folders.map { term ->
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
    cb.exists(sub)
}

private fun flagPredicates(
    ops: SearchOperators,
    userId: UUID,
    root: Root<ArticleEntity>,
    query: CriteriaQuery<*>,
    cb: CriteriaBuilder,
): List<Predicate> = buildList {
    if (ops.isStarred == true) add(starredPredicate(userId, root, query, cb, true))
    if (ops.isUnread == true) add(unreadPredicate(userId, root, query, cb))
    if (ops.isRead == true) add(starredPredicate(userId, root, query, cb, null, read = true))
    // hasVideo/minReadMinutes not enforceable server-side (no columns); client refines.
}

private fun starredPredicate(
    userId: UUID,
    root: Root<ArticleEntity>,
    query: CriteriaQuery<*>,
    cb: CriteriaBuilder,
    starred: Boolean? = null,
    read: Boolean? = null,
): Predicate {
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

internal fun likeContains(term: String): String =
    "%${term.lowercase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")}%"
