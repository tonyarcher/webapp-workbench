package rssapi.persist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "saved_searches")
class SavedSearchEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(name = "user_id", nullable = false)
    var userId: UUID = UUID(0, 0),
    var title: String = "",
    var query: String = "",
    @Column(name = "scope_kind", nullable = false)
    var scopeKind: String = "all",
    @Column(name = "scope_id")
    var scopeId: UUID? = null,
    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,
    @Column(name = "created_at")
    var createdAt: Instant = Instant.now(),
)
