package rssapi.web

import java.time.Instant
import java.util.UUID
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import rssapi.domain.hostTitleFor
import rssapi.domain.normalizeLink
import rssapi.ingest.IngestSync
import rssapi.persist.AffinityEntity
import rssapi.persist.AffinityRepo
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.persist.PendingStateEntity
import rssapi.persist.PendingStateRepo

@Service
class MigrateService(
    private val folders: FolderRepo,
    private val feeds: FeedRepo,
    private val memberships: FolderFeedRepo,
    private val pending: PendingStateRepo,
    private val affinity: AffinityRepo,
    private val sync: IngestSync,
) {
    @Transactional
    fun run(userId: UUID, body: MigrateBody): MigrateResult {
        val folderMap = insertFolders(userId, body.folders)
        val feedMap = insertFeeds(userId, body.feeds, folderMap)
        val queued = insertStates(userId, body.states, feedMap)
        insertAffinity(userId, body.affinity)
        feeds.findByUserIdOrderByAddedAtAsc(userId).forEach { sync.ensureRow(it.id!!) }
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

    private fun insertFeeds(
        userId: UUID,
        rows: List<MigrateFeed>?,
        folderMap: Map<String, UUID>,
    ): Map<String, UUID> {
        val map = mutableMapOf<String, UUID>()
        rows?.forEach { f ->
            val title = f.title ?: hostTitleFor(f.url)
            val row = feeds.findByUserIdAndXmlUrl(userId, f.url)
                ?: feeds.save(FeedEntity(userId = userId, xmlUrl = f.url, title = title, siteUrl = f.siteUrl))
            map[f.url] = row.id!!
            f.folderTitles?.forEach { t ->
                val fid = folderMap[t] ?: return@forEach
                memberships.save(FolderFeedEntity(folderId = fid, feedId = row.id!!))
            }
        }
        return map
    }

    private fun insertStates(
        userId: UUID,
        rows: List<MigrateState>?,
        feedMap: Map<String, UUID>,
    ): Int {
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
