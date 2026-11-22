package rssapi.storage
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import rssapi.articles.ArticleEntity
import rssapi.articles.ArticleRepo
import rssapi.feeds.SubscriptionRepo
import rssapi.platform.IdentityUser
import rssapi.storage.ArticleBodyEntity
import rssapi.storage.ArticleBodyRepo
import java.util.Optional
import java.util.UUID

/**
 * Cold-body restore drill: after a Postgres-only restore the body row has no
 * HTML, only an object key. The reader must still get the body from the object
 * store, and the article row must still be present.
 */
class ColdBodyRestoreDrillTest {
    @Test
    fun coldBodyOpensAfterDatabaseOnlyRestore() {
        val articles: ArticleRepo = mock()
        val bodies: ArticleBodyRepo = mock()
        val subs: SubscriptionRepo = mock()
        val user: IdentityUser = mock()
        val feedId = UUID.randomUUID()
        val userId = UUID.randomUUID()
        val key = "rss/bodies/abc.html"

        whenever(bodies.findById("a1")).thenReturn(Optional.of(ArticleBodyEntity("a1", null, key, 8)))
        whenever(articles.findById("a1")).thenReturn(Optional.of(ArticleEntity(id = "a1", feedId = feedId)))
        whenever(user.id).thenReturn(userId)
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(true)

        val client = object : BodyObjectClient {
            private val objects = mutableMapOf(key to "<p>cold body</p>".toByteArray(Charsets.UTF_8))
            override fun put(key: String, bytes: ByteArray) {
                objects[key] = bytes
            }

            override fun get(key: String): ByteArray? = objects[key]

            override fun delete(key: String) {
                objects.remove(key)
            }
        }
        val store = DbBodyStore(articles, bodies, client, BodyObjectStoreConfig(bucket = "b"))
        val controller = ArticleBodyController(user, articles, subs, store)

        assertEquals("<p>cold body</p>", controller.body("a1").content)
    }

    @Test
    fun missingColdObjectFallsBackToSummaryWithoutBreakingOpen() {
        val articles: ArticleRepo = mock()
        val bodies: ArticleBodyRepo = mock()
        val subs: SubscriptionRepo = mock()
        val user: IdentityUser = mock()
        val feedId = UUID.randomUUID()
        val userId = UUID.randomUUID()

        whenever(bodies.findById("a1")).thenReturn(Optional.of(ArticleBodyEntity("a1", null, "gone", 8)))
        whenever(articles.findById("a1")).thenReturn(Optional.of(ArticleEntity(id = "a1", feedId = feedId)))
        whenever(user.id).thenReturn(userId)
        whenever(subs.existsByUserIdAndFeedId(userId, feedId)).thenReturn(true)

        val store = DbBodyStore(articles, bodies, NoopBodyObjectClient(), BodyObjectStoreConfig(bucket = "b"))
        val controller = ArticleBodyController(user, articles, subs, store)

        assertEquals(null, controller.body("a1").content)
    }
}
