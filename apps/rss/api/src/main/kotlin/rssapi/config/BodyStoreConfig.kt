package rssapi.config

import jakarta.annotation.PreDestroy
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import rssapi.body.BodyObjectClient
import rssapi.body.BodyObjectStoreConfig
import rssapi.body.BodyReadThrough
import rssapi.body.BodyStore
import rssapi.body.DbBodyStore
import rssapi.body.NoopBodyObjectClient
import rssapi.body.S3BodyObjectClient
import rssapi.body.bodyObjectStoreConfigFromEnv
import rssapi.body.buildS3Client
import rssapi.persist.ArticleBodyRepo
import rssapi.persist.ArticleRepo
import software.amazon.awssdk.services.s3.S3Client

@Configuration
class BodyStoreConfig {
    private var s3Client: S3Client? = null

    @Bean
    fun bodyObjectStoreConfig(): BodyObjectStoreConfig = bodyObjectStoreConfigFromEnv()

    @Bean
    fun bodyObjectClient(config: BodyObjectStoreConfig): BodyObjectClient {
        if (!config.enabled()) return NoopBodyObjectClient()
        val client = buildS3Client(config).also { s3Client = it }
        return S3BodyObjectClient(client, config.bucket)
    }

    @Bean
    fun bodyStore(
        articles: ArticleRepo,
        bodies: ArticleBodyRepo,
        objectClient: BodyObjectClient,
        config: BodyObjectStoreConfig,
    ): BodyStore = DbBodyStore(articles, bodies, objectClient, config)

    @Bean
    fun bodyReadThrough(store: BodyStore): BodyReadThrough = BodyReadThrough(store)

    @PreDestroy
    fun close() {
        runCatching { s3Client?.close() }
        s3Client = null
    }
}
