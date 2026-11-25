package timesupapi.interests

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "mute_rules")
class MuteRuleEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(name = "user_id", nullable = false)
    var userId: UUID = UUID.randomUUID(),
    @Column(nullable = false, columnDefinition = "TEXT")
    var terms: String = "",
    @Column(name = "match_target", nullable = false, length = 16)
    var matchTarget: String = "either",
    @Column(nullable = false)
    var enabled: Boolean = true,
    @Column(name = "scope_kind", nullable = false, length = 16)
    var scopeKind: String = "all",
    @Column(name = "scope_folders", columnDefinition = "TEXT")
    var scopeFolders: String? = null,
    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
)
