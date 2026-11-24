package timesupapi.boards

import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController
import timesupapi.feeds.FeedRepo
import timesupapi.platform.ApiException
import timesupapi.platform.IdentityUser
import timesupapi.storage.SnapshotStore

/** Read-only board exports and lazy bodies, split from entry mutations. */
@RestController
class BoardEntryExportController(
    private val user: IdentityUser,
    private val boards: BoardRepo,
    private val entries: BoardEntryRepo,
    private val feeds: FeedRepo,
    private val snapshots: SnapshotStore,
) {
    @GetMapping("/boards/{id}/opml", produces = [MediaType.TEXT_XML_VALUE], headers = ["X-Api-Version=1"])
    fun opml(@PathVariable id: String): ResponseEntity<String> {
        val board = ownedBoard(boards, user.id, boardId(id))
        val rows = entries.findByBoardIdOrderBySortOrderAscAddedAtAsc(board.id!!)
        val feedMap = feeds.findAllById(rows.mapNotNull { it.feedId }.distinct()).associateBy { it.id!! }
        val xml = buildBoardOpml(board.title, rows, feedMap)
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/xml; charset=utf-8")).body(xml)
    }

    @GetMapping("/boards/{id}/entries/{articleId}/content", headers = ["X-Api-Version=1"])
    fun content(@PathVariable id: String, @PathVariable articleId: String): SnapshotContentJson {
        val board = ownedBoard(boards, user.id, boardId(id))
        val row = entries.findByBoardIdAndArticleId(board.id!!, articleId)
            ?: throw ApiException(HttpStatus.NOT_FOUND, "board entry not found")
        return SnapshotContentJson(snapshots.load(row.contentStorageKey, row.contentHtml))
    }
}
