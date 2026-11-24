package timesupapi.feeds
import java.util.UUID

internal fun buildOpml(
    userId: UUID,
    folders: FolderRepo,
    feeds: FeedRepo,
    memberships: FolderFeedRepo,
    subs: SubscriptionRepo,
): String {
    val folderRows = folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId)
    val subscribed = feeds.findAllById(subs.findFeedIdsByUserId(userId)).sortedBy { it.addedAt }
    val membershipRows = membershipRows(folderRows, memberships)
    val feedMap = exportFeedMap(subscribed, membershipRows, feeds)
    val byFolder = membershipRows.groupBy { it.folderId }
    val folderFeedIds = membershipRows.map { it.feedId }.toSet()
    val lines = mutableListOf(
        """<?xml version="1.0" encoding="UTF-8"?>""",
        """<opml version="2.0">""",
        "<head><title>Times Up Export</title></head>",
        "<body>",
    )
    subscribed.filter { it.id !in folderFeedIds }.forEach { lines.add(outline(it, "  ")) }
    folderRows.forEach { lines.addAll(folderLines(it, byFolder[it.id].orEmpty(), feedMap)) }
    lines.add("</body>")
    lines.add("</opml>")
    return lines.joinToString("\n")
}

private fun membershipRows(folders: List<FolderEntity>, memberships: FolderFeedRepo): List<FolderFeedEntity> {
    val ids = folders.mapNotNull { it.id }
    return if (ids.isEmpty()) emptyList() else memberships.findByFolderIdIn(ids)
}

private fun exportFeedMap(
    subscribed: List<FeedEntity>,
    memberships: List<FolderFeedEntity>,
    feeds: FeedRepo,
): Map<UUID?, FeedEntity> {
    val rows = subscribed.associateBy { it.id }.toMutableMap()
    val missing = memberships.map { it.feedId }.filter { it !in rows }.distinct()
    if (missing.isNotEmpty()) feeds.findAllById(missing).forEach { rows[it.id] = it }
    return rows
}

private fun folderLines(
    folder: FolderEntity,
    memberships: List<FolderFeedEntity>,
    feeds: Map<UUID?, FeedEntity>,
): List<String> = buildList {
    add("""  <outline text="${escXml(folder.title)}" title="${escXml(folder.title)}">""")
    memberships.forEach { rel -> feeds[rel.feedId]?.let { add(outline(it, "    ")) } }
    add("  </outline>")
}

private fun outline(feed: FeedEntity, indent: String): String {
    val text = escXml(feed.title)
    return indent +
        """<outline type="rss" text="$text" title="$text" xmlUrl="${escXml(
            feed.xmlUrl,
        )}" htmlUrl="${escXml(feed.siteUrl.orEmpty())}"/>"""
}
