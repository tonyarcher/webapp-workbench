package timesupapi.boards
import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import timesupapi.feeds.IdsBody
import timesupapi.feeds.OkBody
import timesupapi.feeds.TitleBody
import timesupapi.platform.ApiException
import timesupapi.platform.IdentityUser
import timesupapi.platform.isUuid
import timesupapi.platform.toJson
import java.util.UUID

@RestController
class BoardController(private val user: IdentityUser, private val boards: BoardRepo) {
    @GetMapping("/boards", headers = ["X-Api-Version=1"])
    fun list(): BoardListJson =
        BoardListJson(boards.findByUserIdOrderBySortOrderAscCreatedAtAsc(user.id).map { it.toJson() })

    /** Creating a board that already exists by title returns it, so the
     *  sidebar's quick-create cannot produce duplicates. */
    @PostMapping("/boards", headers = ["X-Api-Version=1"])
    fun create(@RequestBody body: TitleBody): BoardJson {
        val title = requireBoardTitle(body.title)
        val existing = boards.findByUserIdAndTitle(user.id, title)
        return (existing ?: boards.save(BoardEntity(userId = user.id, title = title))).toJson()
    }

    @PutMapping("/boards/{id}", headers = ["X-Api-Version=1"])
    fun rename(@PathVariable id: String, @RequestBody body: TitleBody): BoardJson {
        val board = ownedBoard(boards, user.id, boardId(id))
        board.title = requireBoardTitle(body.title)
        return boards.save(board).toJson()
    }

    @DeleteMapping("/boards/{id}", headers = ["X-Api-Version=1"])
    fun delete(@PathVariable id: String): OkBody {
        val board = ownedBoard(boards, user.id, boardId(id))
        boards.delete(board)
        return OkBody()
    }

    @PostMapping("/boards/reorder", headers = ["X-Api-Version=1"])
    @Transactional
    fun reorder(@RequestBody body: IdsBody): OkBody {
        val ids =
            body.ids ?: throw ApiException(HttpStatus.BAD_REQUEST, "ids array is required")
        applyBoardOrder(ids)
        return OkBody()
    }

    private fun applyBoardOrder(ids: List<String>) {
        val uuids = ids.filter { isUuid(it) }.map { UUID.fromString(it) }
        if (uuids.isEmpty()) return
        val rows = boards.findAllById(uuids).filter { it.userId == user.id }
        val order = uuids.withIndex().associate { it.value to it.index }
        rows.forEach { it.sortOrder = order[it.id] ?: it.sortOrder }
        boards.saveAll(rows)
    }
}
