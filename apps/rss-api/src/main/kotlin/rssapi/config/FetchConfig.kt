package rssapi.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import rssapi.fetch.FeedFetcher
import rssapi.fetch.HttpFeedFetcher

@Configuration
class FetchConfig {
    @Bean
    fun feedFetcher(): FeedFetcher =
        HttpFeedFetcher(System.getenv("RSS_ALLOW_LOCAL_FETCH") == "1")
}
