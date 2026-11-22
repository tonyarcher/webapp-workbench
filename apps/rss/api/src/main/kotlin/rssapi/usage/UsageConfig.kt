package rssapi.usage
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/** Feature-usage counters are off unless explicitly enabled. */
data class UsageEnabled(val value: Boolean)

internal fun usageEnabledFromEnv(env: Map<String, String>): UsageEnabled = UsageEnabled(env["USAGE_ENABLED"] == "1")

@Configuration
class UsageConfig {
    @Bean
    fun usageEnabled(): UsageEnabled = usageEnabledFromEnv(System.getenv())
}
