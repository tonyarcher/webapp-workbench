package rssapi.persist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.Version
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "ai_quota")
class AiQuotaEntity(
    @Id
    @Column(name = "user_id")
    var userId: UUID = UUID(0, 0),
    @Column(name = "hour_start")
    var hourStart: Instant = Instant.EPOCH,
    @Column(name = "hour_count")
    var hourCount: Int = 0,
    @Column(name = "day_start")
    var dayStart: Instant = Instant.EPOCH,
    @Column(name = "day_count")
    var dayCount: Int = 0,
    @Version
    var version: Long = 0,
)
