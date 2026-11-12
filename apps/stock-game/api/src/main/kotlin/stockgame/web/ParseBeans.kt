package stockgame.web

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import stockgame.ai.AiConfig
import stockgame.ai.DecisionBackend
import stockgame.ai.aiConfigFromEnv
import stockgame.parse.OrderParseProvider

/**
 * Decision-model wiring for the natural-language order parser. The TypeSafe
 * key arrives only via TYPESAFE_API_KEY in the untracked deploy/.env; nothing
 * here ever logs or exposes it.
 */
@Configuration
class ParseBeans {
    @Bean
    fun parseAiConfig(): AiConfig = aiConfigFromEnv()

    @Bean
    fun orderParseProvider(config: AiConfig): OrderParseProvider = OrderParseProvider(DecisionBackend(config))
}
