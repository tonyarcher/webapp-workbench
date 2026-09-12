package rssapi.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository

interface FeedRepo : JpaRepository<FeedEntity, UUID> {
    fun findByXmlUrl(xmlUrl: String): FeedEntity?
}
