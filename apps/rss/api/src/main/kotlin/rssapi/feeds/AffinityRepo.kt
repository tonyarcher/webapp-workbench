package rssapi.feeds
import org.springframework.data.jpa.repository.JpaRepository

interface AffinityRepo : JpaRepository<AffinityEntity, AffinityId>
