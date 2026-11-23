package rssapi.feeds
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import rssapi.articles.normalizeLink
import rssapi.ingest.IngestSync
import rssapi.platform.hostTitleFor
import java.time.Instant
import java.util.UUID

@Service
class MigrateService(
    private val folders: FolderRepo,
    private val feeds: FeedRepo,
    private val pending: PendingStateRepo,
    private val affinity: AffinityRepo,
    private val sync: IngestSync,
    private val subs: SubscriptionRepo,
    private val membershipService: MembershipService,
) {
    @Transactional
    fun run(userId: UUID, body: MigrateBody): MigrateResult {
        val folderMap = insertFolders(userId, body.folders)
        val feedMap = insertFeeds(userId, body.feeds, folderMap)
        val queued = insertStates(userId, body.states, feedMap)
        insertAffinity(userId, body.affinity)
        feedMap.values.forEach { sync.ensureRow(it) }
        return MigrateResult(feedMap.size, folderMap.size, queued)
    }

    private fun insertFolders(userId: UUID, rows: List<MigrateFolder>?): Map<String, UUID> {
        val map = mutableMapOf<String, UUID>()
        rows?.forEach { f ->
            val row = folders.findByUserIdAndTitle(userId, f.title)
                ?: folders.save(FolderEntity(userId = userId, title = f.title, sortOrder = f.sortOrder ?: 0))
            map[f.title] = row.id!!
        }
        return map
    }

    private fun insertFeeds(userId: UUID, rows: List<MigrateFeed>?, folderMap: Map<String, UUID>): Map<String, UUID> {
        val map = mutableMapOf<String, UUID>()
        rows?.forEach { f ->
            val title = f.title ?: hostTitleFor(f.url)
            val row = feeds.findByXmlUrl(f.url)
                ?: feeds.save(
                    FeedEntity(
                        xmlUrl = f.url,
                        title = title,
                        siteUrl = f.siteUrl,
                        connectorId = "rss",
                        connectorVersion = "1",
                    ),
                )
            if (!subs.existsByUserIdAndFeedId(userId, row.id!!)) {
                subs.save(SubscriptionEntity(userId = userId, feedId = row.id!!))
            }
            map[f.url] = row.id!!
            f.folderTitles?.forEach { t ->
                val fid = folderMap[t] ?: return@forEach
                membershipService.addMembership(fid, row.id!!)
            }
        }
        return map
    }

    private fun insertStates(userId: UUID, rows: List<MigrateState>?, feedMap: Map<String, UUID>): Int {
        var n = 0
        rows?.forEach { s ->
            val feedId = feedMap[s.feedUrl] ?: return@forEach
            pending.save(
                PendingStateEntity(
                    userId = userId,
                    feedId = feedId,
                    guid = s.guid,
                    normLink = s.link?.let { normalizeLink(it) },
                    link = s.link,
                    read = s.read,
                    readAt = s.readAt?.let { Instant.ofEpochMilli(it) },
                    starred = s.starred,
                ),
            )
            n += 1
        }
        return n
    }

    private fun insertAffinity(userId: UUID, rows: List<MigrateAffinity>?) {
        rows?.forEach { a ->
            affinity.save(AffinityEntity(userId = userId, key = a.key, value = a.value.toFloat()))
        }
    }
}
