package timesupapi.boards
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.util.UUID

interface BoardEntryRepo : JpaRepository<BoardEntryEntity, UUID> {
    fun findByBoardIdOrderBySortOrderAscAddedAtAsc(boardId: UUID): List<BoardEntryEntity>
    fun findByBoardIdAndArticleId(boardId: UUID, articleId: String): BoardEntryEntity?
    fun findByBoardIdAndArticleIdIn(boardId: UUID, articleIds: Collection<String>): List<BoardEntryEntity>
    fun findFirstByBoardIdOrderBySortOrderDesc(boardId: UUID): BoardEntryEntity?
    fun deleteByBoardIdAndArticleId(boardId: UUID, articleId: String)

    interface Summary {
        val id: UUID
        val articleId: String
        val feedId: UUID?
        val feedTitle: String?
        val title: String
        val link: String?
        val author: String?
        val summary: String?
        val publishedAt: Instant?
        val note: String
        val addedAt: Instant
        val sortOrder: Int
        val contentPending: Boolean
    }

    @Query(
        """
        select e.id as id, e.articleId as articleId, e.feedId as feedId, e.feedTitle as feedTitle,
               e.title as title, e.link as link, e.author as author, e.summary as summary,
               e.publishedAt as publishedAt, e.note as note, e.addedAt as addedAt, e.sortOrder as sortOrder,
               case when e.contentStorageKey is not null or e.contentHtml is not null then true else false end as contentPending
        from BoardEntryEntity e
        where e.boardId = :boardId
        order by e.sortOrder asc, e.addedAt asc
        """,
    )
    fun findSummariesByBoardIdOrderBySortOrderAscAddedAtAsc(@Param("boardId") boardId: UUID): List<Summary>
}
