package rssapi.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository

interface FeedRepo : JpaRepository<FeedEntity, UUID> {
    fun findByUserIdOrderByAddedAtAsc(userId: UUID): List<FeedEntity>
    fun findByUserIdAndXmlUrl(userId: UUID, xmlUrl: String): FeedEntity?
    fun findByUserIdAndId(userId: UUID, id: UUID): FeedEntity?
}
