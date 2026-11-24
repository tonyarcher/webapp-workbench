package timesupapi.fetch
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import timesupapi.platform.settingsFromEnv
@Configuration
class FetchBeans {
    @Bean
    fun pageFetcher(): PageFetcher = HttpPageFetcher(settingsFromEnv(System.getenv()).allowLocalFetch)
}
