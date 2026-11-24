package timesupapi.platform
import com.github.benmanes.caffeine.cache.Caffeine
import org.springframework.cache.CacheManager
import org.springframework.cache.annotation.EnableCaching
import org.springframework.cache.caffeine.CaffeineCacheManager
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Duration

const val CACHE_MAX_ENTRIES: Long = 2_000
const val CACHE_TTL_MINUTES: Long = 10

/** One bounded manager for the API. Caches are created on first use. */
@Configuration
@EnableCaching
class CacheConfig {
    @Bean
    fun cacheManager(): CacheManager {
        val spec = Caffeine.newBuilder()
            .maximumSize(CACHE_MAX_ENTRIES)
            .expireAfterWrite(Duration.ofMinutes(CACHE_TTL_MINUTES))
        return CaffeineCacheManager().apply { setCaffeine(spec) }
    }
}
