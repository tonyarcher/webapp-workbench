package rssapi.persist

import java.time.Instant
import java.util.UUID
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "feeds")
class FeedEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(name = "xml_url", nullable = false)
    var xmlUrl: String = "",
    @Column(name = "site_url")
    var siteUrl: String? = null,
    var title: String = "",
    @Column(name = "added_at")
    var addedAt: Instant = Instant.now(),
)
