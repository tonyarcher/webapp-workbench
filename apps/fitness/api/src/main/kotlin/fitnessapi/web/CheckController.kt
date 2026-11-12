package fitnessapi.web

import fitnessapi.LOCAL_USER_ID
import fitnessapi.ai.AiConfig
import fitnessapi.ai.AiQuotaService
import fitnessapi.check.CHECK_MAX_PER_CALL
import fitnessapi.check.CheckCandidate
import fitnessapi.check.CheckVerdict
import fitnessapi.check.PlausibilityProvider
import fitnessapi.check.verdictFor
import fitnessapi.domain.parseMetricId
import fitnessapi.store.SampleStore
import org.springframework.beans.factory.ObjectProvider
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

data class CheckSampleBody(val metric: String?, val t: Double?, val valueSi: Double?)

data class CheckRequestBody(val samples: List<CheckSampleBody>?)

data class CheckVerdictJson(val id: String, val valid: Boolean, val flagged: Boolean, val method: String)

data class CheckResponseJson(val checks: List<CheckVerdictJson>)

/**
 * Advisory import check. Code validates shape and metric first; recent
 * history (latest value plus rollup average) goes to the decision model behind
 * the per-user quota when `AI_PROVIDER=decision` with a key. Flags never block
 * the import and the endpoint never persists anything. Never logs payloads.
 */
@RestController
class CheckController(
    private val samples: ObjectProvider<SampleStore>,
    private val aiConfig: AiConfig,
    private val quotas: AiQuotaService,
    private val provider: PlausibilityProvider,
) {
    @PostMapping("/imports/check", headers = ["X-Api-Version=1"])
    fun check(@RequestBody body: CheckRequestBody): CheckResponseJson {
        val events = checkedSamples(body.samples)
        val (valid, invalid) = splitEvents(events, samples.orOffline())
        val enabled = aiConfig.provider == "decision" && aiConfig.decisionApiKey.isNotEmpty()
        if (!enabled) return json(invalid + valid.map { verdictFor(it.id, null) })
        quotas.consume(LOCAL_USER_ID, aiConfig.hourlyLimit, aiConfig.dailyLimit)
        return try {
            val scores = provider.scoreBatch(valid)
            json(invalid + valid.map { verdictFor(it.id, scores[it.id]) })
        } catch (_: Exception) {
            json(invalid + valid.map { verdictFor(it.id, null) })
        }
    }

    private fun checkedSamples(events: List<CheckSampleBody>?): List<CheckSampleBody> {
        if (events == null) badRequest("missing samples")
        if (events.size > CHECK_MAX_PER_CALL) badRequest("too many samples")
        return events
    }

    private fun splitEvents(
        events: List<CheckSampleBody>,
        store: SampleStore,
    ): Pair<List<CheckCandidate>, List<CheckVerdict>> {
        val latestByMetric = store.latest(LOCAL_USER_ID).associate { it.metric to it.valueSi }
        val avgByMetric = store.rollups(LOCAL_USER_ID).groupBy({ it.metric }, { it.avgSi })
            .mapValues { (_, avgs) -> avgs.filterNotNull().lastOrNull() }
        val historyN = store.stats(LOCAL_USER_ID).associate { it.metric to it.n }
        val valid = events.mapIndexedNotNull { index, event ->
            toCandidate(index, event, latestByMetric, avgByMetric, historyN)
        }
        val validIds = valid.map { it.id }.toSet()
        val invalid = events.indices
            .filter { "s$it" !in validIds }
            .map { CheckVerdict("s$it", valid = false, flagged = false, method = "code") }
        return valid to invalid
    }

    private fun toCandidate(
        index: Int,
        event: CheckSampleBody,
        latest: Map<String, Double>,
        avg: Map<String, Double?>,
        history: Map<String, Long>,
    ): CheckCandidate? {
        val metric = parseMetricId(event.metric.orEmpty()) ?: return null
        val value = event.valueSi?.takeIf { it.isFinite() } ?: return null
        event.t?.takeIf { it.isFinite() } ?: return null
        return CheckCandidate(
            id = "s$index",
            metric = metric,
            valueSi = value,
            latestValueSi = latest[metric],
            avgSi = avg[metric],
            historyN = history[metric] ?: 0L,
        )
    }
}

private fun json(verdicts: List<CheckVerdict>): CheckResponseJson =
    CheckResponseJson(verdicts.map { CheckVerdictJson(it.id, it.valid, it.flagged, it.method) })

private fun badRequest(message: String): Nothing = throw ApiException(HttpStatus.BAD_REQUEST, message)
