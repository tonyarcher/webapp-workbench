package timesupapi.interests

import org.springframework.stereotype.Service
import timesupapi.feeds.FeedEntity
import timesupapi.feeds.FeedRepo
import timesupapi.feeds.SubscriptionEntity
import timesupapi.feeds.SubscriptionRepo
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.Clock
import java.util.UUID

private const val SENSOR_CONNECTOR = "google-news-search"
private const val SENSOR_VERSION = "1"
private const val WINDOW_DAYS = 1
private const val MAX_SENSORS = 5

@Service
class TopicSensorService(private val feeds: FeedRepo, private val subs: SubscriptionRepo) {
    internal var clock: Clock = Clock.systemUTC()

    fun buildUrl(label: String): String {
        val q = if (label.contains(" ")) "\"$label\"" else label
        val encoded = URLEncoder.encode("$q when:1d", StandardCharsets.UTF_8)
        return "https://news.google.com/rss/search?q=$encoded&hl=en-US&gl=US&ceid=US:en"
    }

    fun createSensor(userId: UUID, label: String): FeedEntity {
        val url = buildUrl(label)
        val existing = feeds.findByXmlUrl(url)
        val feed = if (existing != null) {
            existing
        } else {
            feeds.save(
                FeedEntity(
                    xmlUrl = url,
                    title = "Sensor: $label",
                    connectorId = SENSOR_CONNECTOR,
                    connectorVersion = SENSOR_VERSION,
                ),
            )
        }
        if (!subs.existsByUserIdAndFeedId(userId, feed.id!!)) {
            subs.save(SubscriptionEntity(userId = userId, feedId = feed.id!!))
        }
        return feed
    }

    fun rotate(userId: UUID, topics: List<String>, maxSensors: Int = MAX_SENSORS): List<FeedEntity> {
        val ranked = topics.take(maxSensors)
        return ranked.map { createSensor(userId, it) }
    }
}
