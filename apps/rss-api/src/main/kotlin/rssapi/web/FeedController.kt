package rssapi.web

import java.net.URI
import java.util.UUID
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.isUuid
import rssapi.domain.safeHttpUrl
import rssapi.ingest.IngestService
import rssapi.ingest.IngestSync
import rssapi.persist.ArticleRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FeedSyncRepo
import rssapi.persist.FolderRepo
import rssapi.persist.SubscriptionEntity
import rssapi.persist.SubscriptionRepo

@RestController
class FeedController(
    private val user: IdentityUser,
    private val feeds: FeedRepo,
    private val folders: FolderRepo,
    private val ingest: IngestService,
    private val sync: IngestSync,
    private val articleRepo: ArticleRepo,
    private val syncRows: FeedSyncRepo,
    private val subs: SubscriptionRepo,
    private val membershipService: MembershipService,
) {
    @PostMapping("/feeds")
    fun create(@RequestBody body: CreateFeedBody): FeedJson {
        val url = body.url ?: throw ApiException(400, "url is required")
        val validated = safeHttpUrl(url) ?: throw ApiException(400, "Invalid feed URL (must be http/https)")
        val folderIds = parseFolderIds(body.folderIds ?: emptyList())
        requireOwnedFolders(folderIds)
        val title = URI(validated).toURL().host
        val feed = upsertFeed(validated, title)
        ensureSubscribed(feed.id!!)
        folderIds.forEach { membershipService.addMembership(it, feed.id!!) }
        sync.ensureRow(feed.id!!)
        ingest.fetchAndIngest(feed.id!!)
        return loadedFeed(feed.id!!)
    }

    @DeleteMapping("/feeds/{id}")
    @Transactional
    fun delete(@PathVariable id: String): OkBody {
        if (!isUuid(id)) throw ApiException(400, "invalid feed id")
        val feedId = UUID.fromString(id)
        requireSubscribed(feedId)
        subs.deleteByUserIdAndFeedId(user.id, feedId)
        membershipService.removeOwnMemberships(user.id, feedId)
        if (subs.countByFeedId(feedId) == 0L) {
            feeds.findById(feedId).ifPresent { feeds.delete(it) }
        }
        return OkBody()
    }

    @PutMapping("/feeds/{id}/folders")
    @Transactional
    fun setFolders(@PathVariable id: String, @RequestBody body: FolderIdsBody): OkBody {
        if (!isUuid(id)) throw ApiException(400, "invalid feed id")
        val folderIds = body.folderIds ?: throw ApiException(400, "folderIds array is required")
        val feedId = UUID.fromString(id)
        requireSubscribed(feedId)
        val uuids = parseFolderIds(folderIds)
        requireOwnedFolders(uuids)
        membershipService.removeOwnMemberships(user.id, feedId)
        uuids.forEach { membershipService.addMembership(it, feedId) }
        return OkBody()
    }

    private fun loadedFeed(feedId: UUID): FeedJson {
        requireSubscribed(feedId)
        val fresh = feeds.findById(feedId).orElseThrow { ApiException(404, "Feed not found") }
        val st = syncRows.findById(feedId).orElse(null)
        return fresh.toJson(
            membershipService.ownedFolderIds(user.id, feedId),
            articleRepo.countUnread(feedId, user.id).toInt(),
            st?.lastFetchedAt?.toEpochMilli(),
            st?.lastError,
        )
    }

    private fun requireSubscribed(feedId: UUID) {
        if (!subs.existsByUserIdAndFeedId(user.id, feedId)) throw ApiException(404, "Feed not found")
    }

    private fun ensureSubscribed(feedId: UUID) {
        if (!subs.existsByUserIdAndFeedId(user.id, feedId)) {
            subs.save(SubscriptionEntity(userId = user.id, feedId = feedId))
        }
    }

    private fun upsertFeed(url: String, title: String): FeedEntity {
        val existing = feeds.findByXmlUrl(url)
        if (existing != null) return existing
        return feeds.save(FeedEntity(xmlUrl = url, title = title))
    }

    private fun requireOwnedFolders(ids: List<UUID>) {
        if (ids.isEmpty()) return
        val owned = folders.findByUserIdAndIdIn(user.id, ids)
        if (owned.size != ids.size) throw ApiException(400, "Unknown folder in folderIds")
    }

    private fun parseFolderIds(raw: List<String>): List<UUID> {
        if (raw.any { !isUuid(it) }) throw ApiException(400, "Unknown folder in folderIds")
        return raw.map { UUID.fromString(it) }
    }
}
