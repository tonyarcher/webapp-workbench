package calsync.web

import calsync.ai.AiConfig
import calsync.ai.DecisionBackend
import calsync.ai.aiConfigFromEnv
import calsync.match.MatchProvider
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * Decision-model wiring for the stateless match suggester. The TypeSafe key
 * arrives only via TYPESAFE_API_KEY in the untracked deploy/.env; nothing
 * here ever logs or exposes it.
 */
@Configuration
class MatchBeans {
    @Bean
    fun matchAiConfig(): AiConfig = aiConfigFromEnv()

    @Bean
    fun matchProvider(config: AiConfig): MatchProvider = MatchProvider(DecisionBackend(config))
}
