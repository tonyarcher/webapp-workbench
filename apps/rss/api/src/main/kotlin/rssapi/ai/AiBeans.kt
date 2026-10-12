package rssapi.ai

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import rssapi.frontpage.DecisionScoreProvider
import rssapi.frontpage.SignalScoreProvider

/**
 * Env-derived AI knobs and the decision-model batch scorer. The TypeSafe key arrives
 * only via TYPESAFE_API_KEY in the untracked deploy/.env; nothing here
 * ever logs or exposes it.
 */
@Configuration
class AiBeans {
    @Bean
    fun aiConfig(): AiConfig = aiConfigFromEnv()

    @Bean
    fun decisionScoreProvider(config: AiConfig, signals: SignalScoreProvider): DecisionScoreProvider =
        DecisionScoreProvider(DecisionBackend(config), signals)
}
