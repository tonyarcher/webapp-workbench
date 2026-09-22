package rssapi.persist

import java.util.UUID
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.repository.JpaRepository

interface EditionRepo : JpaRepository<EditionEntity, UUID> {
    fun findTopByUserIdAndStatusOrderByCreatedAtDesc(userId: UUID, status: String): EditionEntity?

    fun findByUserId(userId: UUID, sort: Sort): List<EditionEntity>

    /** Prunes one owner's editions to the newest [keep]; called after every build. */
    fun deleteOld(userId: UUID, keep: Int) {
        val all = findByUserId(userId, Sort.by("createdAt").descending())
        if (all.size > keep) deleteAll(all.drop(keep))
    }
}
