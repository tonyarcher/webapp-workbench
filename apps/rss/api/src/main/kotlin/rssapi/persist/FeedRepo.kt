package rssapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface FeedRepo : JpaRepository<FeedEntity, UUID> {
    fun findByXmlUrl(xmlUrl: String): FeedEntity?
    fun findByXmlUrlIn(xmlUrls: Collection<String>): List<FeedEntity>
}
