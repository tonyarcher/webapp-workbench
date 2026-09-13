package rssapi.web

import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.escXml
import rssapi.persist.FeedEntity
import rssapi.persist.FeedRepo
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import rssapi.persist.SubscriptionRepo

data class OpmlImportBody(val xml: String?)

data class OpmlImportResult(
    val addedFeeds: Int,
    val addedFolders: Int,
    val subscribedFeeds: Int = 0,
    val skippedFeeds: Int = 0,
    val folders: List<FolderJson> = emptyList(),
    val feeds: List<FeedJson> = emptyList(),
)

@RestController
class OpmlController(
    private val user: IdentityUser,
    private val folders: FolderRepo,
    private val feeds: FeedRepo,
    private val memberships: FolderFeedRepo,
    private val subs: SubscriptionRepo,
    private val importer: OpmlImportService,
    private val membershipService: MembershipService,
) {
    @GetMapping("/opml", produces = [MediaType.TEXT_XML_VALUE])
    fun export(): ResponseEntity<String> {
        val xml = buildOpml()
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/xml; charset=utf-8")).body(xml)
    }

    @PostMapping("/opml")
    fun importOpml(@RequestBody body: OpmlImportBody): OpmlImportResult {
        val xml = body.xml ?: throw ApiException(400, "xml string is required")
        return importer.run(user.id, xml)
    }

    private fun buildOpml(): String {
        val folderRows = folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(user.id)
        val feedRows = feeds.findAllById(subs.findFeedIdsByUserId(user.id)).sortedBy { it.addedAt }
        val lines = mutableListOf(
            """<?xml version="1.0" encoding="UTF-8"?>""",
            """<opml version="2.0">""",
            "<head><title>RSS Reader Export</title></head>",
            "<body>",
        )
        for (f in feedRows) {
            if (membershipService.ownedFolderIds(user.id, f.id!!).isNotEmpty()) continue
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
