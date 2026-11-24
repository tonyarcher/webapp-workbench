package timesupapi.boards
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface BoardEntryRepo : JpaRepository<BoardEntryEntity, UUID> {
    fun findByBoardIdOrderBySortOrderAscAddedAtAsc(boardId: UUID): List<BoardEntryEntity>
    fun findByBoardIdAndArticleId(boardId: UUID, articleId: String): BoardEntryEntity?
    fun findByBoardIdAndArticleIdIn(boardId: UUID, articleIds: Collection<String>): List<BoardEntryEntity>
    fun findFirstByBoardIdOrderBySortOrderDesc(boardId: UUID): BoardEntryEntity?
    fun deleteByBoardIdAndArticleId(boardId: UUID, articleId: String)
}
