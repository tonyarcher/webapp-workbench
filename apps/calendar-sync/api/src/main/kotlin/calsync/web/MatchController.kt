package calsync.web

import calsync.ai.AiConfig
import calsync.ai.AiQuotaService
import calsync.match.MATCH_MAX_PER_SIDE
import calsync.match.MatchEvent
import calsync.match.MatchProvider
import calsync.match.MatchSuggestion
import calsync.match.exactMatches
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

data class MatchEventBody(val uid: String?, val title: String?)

data class MatchSuggestBody(val trakt: List<MatchEventBody>?, val netflix: List<MatchEventBody>?)

data class MatchSuggestionJson(val traktUid: String, val netflixUid: String, val score: Double, val method: String)

data class MatchSuggestJson(val matches: List<MatchSuggestionJson>)

/**
 * Stateless merge suggester. Exact normalized-title matches always resolve in
 * code. Fuzzy pairs go through the decision model behind the per-user quota
 * when `AI_PROVIDER=decision` with a key; otherwise the endpoint returns the
 * exact matches only. Never persists events.
 */
@RestController
class MatchController(
    private val user: IdentityUser,
    private val aiConfig: AiConfig,
    private val quotas: AiQuotaService,
    private val provider: MatchProvider,
) {
    @PostMapping("/match/suggest", headers = ["X-Api-Version=1"])
    fun suggest(@RequestBody body: MatchSuggestBody): MatchSuggestJson {
        val trakt = checkedEvents(body.trakt)
        val netflix = checkedEvents(body.netflix)
        val enabled = aiConfig.provider == "decision" && aiConfig.decisionApiKey.isNotEmpty()
        if (!enabled) return json(exactOnly(trakt, netflix))
        checkedBudget(trakt, netflix)
        quotas.consume(user.id, aiConfig.hourlyLimit, aiConfig.dailyLimit)
        return try {
            json(provider.suggest(trakt, netflix))
        } catch (_: Exception) {
            json(exactOnly(trakt, netflix))
        }
    }

    private fun checkedEvents(events: List<MatchEventBody>?): List<MatchEvent> {
        if (events == null) badRequest("missing events")
        if (events.size > MATCH_MAX_PER_SIDE) badRequest("too many events")
        return events.map {
            val uid = it.uid?.takeIf { value -> value.isNotBlank() } ?: badRequest("missing uid")
            val title = it.title?.takeIf { value -> value.isNotBlank() } ?: badRequest("missing title")
            MatchEvent(uid, title)
        }
    }

    private fun exactOnly(trakt: List<MatchEvent>, netflix: List<MatchEvent>): List<MatchSuggestion> =
        exactMatches(trakt, netflix)

    private fun checkedBudget(trakt: List<MatchEvent>, netflix: List<MatchEvent>) {
        val total = trakt.sumOf { it.title.length } + netflix.sumOf { it.title.length }
        if (total >
            aiConfig.maxInputChars
        ) {
            throw ApiException(HttpStatusCode.valueOf(HTTP_PAYLOAD_TOO_LARGE), "too large")
        }
    }
}

private fun json(matches: List<MatchSuggestion>): MatchSuggestJson =
    MatchSuggestJson(matches.map { MatchSuggestionJson(it.traktUid, it.netflixUid, it.score, it.method) })

private const val HTTP_PAYLOAD_TOO_LARGE: Int = 413

private fun badRequest(message: String): Nothing = throw ApiException(HttpStatus.BAD_REQUEST, message)
