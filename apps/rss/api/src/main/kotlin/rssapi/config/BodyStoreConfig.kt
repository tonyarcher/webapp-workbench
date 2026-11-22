package rssapi.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import rssapi.body.BodyReadThrough
import rssapi.body.BodyStore
import rssapi.body.DbBodyStore
import rssapi.persist.ArticleBodyRepo
import rssapi.persist.ArticleRepo

@Configuration
class BodyStoreConfig {
    @Bean
    fun bodyStore(articles: ArticleRepo, bodies: ArticleBodyRepo): BodyStore = DbBodyStore(articles, bodies)

    @Bean
    fun bodyReadThrough(store: BodyStore): BodyReadThrough = BodyReadThrough(store)
}
