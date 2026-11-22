package rssapi.platform
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import rssapi.articles.ARTICLE_EXCERPT_CACHE

class CacheConfigTest {
    @Test
    fun managerProvidesTheExcerptCache() {
        val cache = CacheConfig().cacheManager().getCache(ARTICLE_EXCERPT_CACHE)

        assertNotNull(cache)
        assertEquals(ARTICLE_EXCERPT_CACHE, cache?.name)
    }
}
