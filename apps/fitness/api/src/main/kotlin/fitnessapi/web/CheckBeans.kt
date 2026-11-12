package fitnessapi.web

import fitnessapi.ai.AiConfig
import fitnessapi.ai.DecisionBackend
import fitnessapi.ai.aiConfigFromEnv
import fitnessapi.check.PlausibilityProvider
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * Decision-model wiring for the advisory import check. The TypeSafe key
 * arrives only via TYPESAFE_API_KEY in the untracked deploy/.env; nothing
 * here ever logs or exposes it.
 */
@Configuration
class CheckBeans {
    @Bean
    fun checkAiConfig(): AiConfig = aiConfigFromEnv()

    @Bean
    fun plausibilityProvider(config: AiConfig): PlausibilityProvider = PlausibilityProvider(DecisionBackend(config))
}
