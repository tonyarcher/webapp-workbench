package rssapi.storage
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import rssapi.articles.ArticleRepo
import rssapi.storage.ArticleBodyRepo
class BodyStoreConfigTest {
    @Test
    fun createsBeansWhenDisabled() {
        val cfg = BodyStoreConfig()
        val config = BodyObjectStoreConfig()
        val client = cfg.bodyObjectClient(config)
        assertNotNull(client)
        val store = cfg.bodyStore(mock<ArticleRepo>(), mock<ArticleBodyRepo>(), client, config)
        assertNotNull(store)
        assertNotNull(cfg.bodyReadThrough(store))
        cfg.close()
    }

    @Test
    fun createsS3ClientWhenEnabled() {
        val cfg = BodyStoreConfig()
        val config = BodyObjectStoreConfig(
            endpoint = "http://localhost:9000",
            bucket = "b",
            accessKey = "a",
            secretKey = "s",
        )
        val client = cfg.bodyObjectClient(config)
        assertNotNull(client)
        cfg.close()
    }
}
