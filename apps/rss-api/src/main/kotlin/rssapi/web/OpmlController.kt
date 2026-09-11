package rssapi.web

import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.OpmlFolder
import rssapi.domain.OpmlNode
import rssapi.domain.OpmlSource
import rssapi.domain.escXml
import rssapi.domain.parseOpml
import rssapi.ingest.IngestSync
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo

data class OpmlImportBody(val xml: String?)

data class OpmlImportResult(val addedFeeds: Int, val addedFolders: Int)

@RestController
class OpmlController(
    private val user: CookieUser,
    private val folders: FolderRepo,
    private val feeds: FeedRepo,
    private val memberships: FolderFeedRepo,
    private val sync: IngestSync,
) {
    @GetMapping("/opml", produces = [MediaType.TEXT_XML_VALUE])
    fun export(): ResponseEntity<String> {
        val xml = buildOpml()
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/xml; charset=utf-8")).body(xml)
    }

    @PostMapping("/opml")
    fun importOpml(@RequestBody body: OpmlImportBody): OpmlImportResult {
        val xml = body.xml ?: throw ApiException(400, "xml string is required")
        val nodes = parseOpml(xml)
        val counters = intArrayOf(0, 0)
        walk(nodes, null, counters)
        feeds.findByUserIdOrderByAddedAtAsc(user.id).forEach { sync.ensureRow(it.id!!) }
        return OpmlImportResult(addedFeeds = counters[0], addedFolders = counters[1])
    }

    private fun walk(nodes: List<OpmlNode>, parentId: java.util.UUID?, counters: IntArray) {
        for (node in nodes) {
            if (node is OpmlFolder) {
                val folder = folders.findByUserIdAndTitle(user.id, node.title)
                    ?: folders.save(FolderEntity(userId = user.id, title = node.title))
                counters[1] += 1
                walk(node.children, folder.id, counters)
            } else if (node is OpmlSource && node.xmlUrl.isNotEmpty()) {
                addSource(node, parentId, counters)
            }
        }
    }

    private fun addSource(node: OpmlSource, parentId: java.util.UUID?, counters: IntArray) {
        val existing = feeds.findByUserIdAndXmlUrl(user.id, node.xmlUrl)
        if (existing != null) return
        val feed = feeds.save(
            FeedEntity(userId = user.id, xmlUrl = node.xmlUrl, title = node.title, siteUrl = node.htmlUrl),
        )
        counters[0] += 1
        if (parentId != null) memberships.save(FolderFeedEntity(folderId = parentId, feedId = feed.id!!))
    }

    private fun buildOpml(): String {
        val folderRows = folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(user.id)
        val feedRows = feeds.findByUserIdOrderByAddedAtAsc(user.id)
        val lines = mutableListOf(
            """<?xml version="1.0" encoding="UTF-8"?>""",
            """<opml version="2.0">""",
            "<head><title>RSS Reader Export</title></head>",
            "<body>",
        )
        for (f in feedRows) {
            if (memberships.findByFeedId(f.id!!).isNotEmpty()) continue
            lines.add(outline(f, "  "))
        }
        for (folder in folderRows) {
            lines.add("""  <outline text="${escXml(folder.title)}" title="${escXml(folder.title)}">""")
            memberships.findByFolderId(folder.id!!).forEach { rel ->
                feeds.findById(rel.feedId).ifPresent { lines.add(outline(it, "    ")) }
            }
            lines.add("  </outline>")
        }
        lines.add("</body>")
        lines.add("</opml>")
        return lines.joinToString("\n")
    }

    private fun outline(f: FeedEntity, indent: String): String {
        val html = f.siteUrl.orEmpty()
        val text = escXml(f.title)
        val xmlUrl = escXml(f.xmlUrl)
        return indent +
            """<outline type="rss" text="$text" title="$text" xmlUrl="$xmlUrl" htmlUrl="${escXml(html)}"/>"""
    }
}
