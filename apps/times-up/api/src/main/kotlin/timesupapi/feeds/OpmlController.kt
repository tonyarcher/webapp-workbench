package timesupapi.feeds
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import timesupapi.platform.ApiException
import timesupapi.platform.IdentityUser

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
) {
    @GetMapping("/opml", produces = [MediaType.TEXT_XML_VALUE], headers = ["X-Api-Version=1"])
    fun export(): ResponseEntity<String> {
        val xml = buildOpml()
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/xml; charset=utf-8")).body(xml)
    }

    @PostMapping("/opml", headers = ["X-Api-Version=1"])
    fun importOpml(@RequestBody body: OpmlImportBody): OpmlImportResult {
        val xml = body.xml ?: throw ApiException(HttpStatus.BAD_REQUEST, "xml string is required")
        return importer.run(user.id, xml)
    }

    private fun buildOpml(): String = buildOpml(user.id, folders, feeds, memberships, subs)
}
