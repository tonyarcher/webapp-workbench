package timesupapi.feeds
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

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
    @Column(name = "icon")
    var icon: String? = null,
    @Column(name = "added_at")
    var addedAt: Instant = Instant.now(),
    @Column(name = "source_kind")
    var sourceKind: String = "rss",
    @Column(name = "connector_id")
    var connectorId: String? = null,
    @Column(name = "connector_version")
    var connectorVersion: String? = null,
    @Column(name = "page_url")
    var pageUrl: String? = null,
    @Column(name = "item_selector")
    var itemSelector: String? = null,
    @Column(name = "last_scrape_at")
    var lastScrapeAt: Instant? = null,
)
