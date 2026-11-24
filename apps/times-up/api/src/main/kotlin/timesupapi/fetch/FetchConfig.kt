package timesupapi.fetch
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import timesupapi.fetch.FeedFetcher
@Configuration
class FetchConfig {
    @Bean
    fun feedFetcher(): FeedFetcher = feedFetcherFor(System.getenv())
}

internal fun feedFetcherFor(env: Map<String, String>): FeedFetcher = HttpFeedFetcher(allowLocalFetchFromEnv(env))

internal fun allowLocalFetchFromEnv(env: Map<String, String>): Boolean =
    (env["TIMES_UP_ALLOW_LOCAL_FETCH"] ?: env["RSS_ALLOW_LOCAL_FETCH"]) == "1"
