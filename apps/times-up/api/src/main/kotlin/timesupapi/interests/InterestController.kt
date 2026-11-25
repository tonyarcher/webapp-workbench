package timesupapi.interests

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import timesupapi.platform.IdentityUser

data class InterestJson(
    val id: String,
    val kind: String,
    val label: String,
    val key: String,
    val weight: Double,
    val origin: String,
    val enabled: Boolean,
)

data class ImportRequest(val topics: String? = null, val sources: String? = null)
data class ImportResponse(val fingerprint: String, val topics: ImportReport, val sources: ImportReport)

data class CandidateRequest(val labels: List<String> = emptyList())
data class CandidateResponse(val candidates: List<CandidateResult>)

data class LaneJson(val articleId: String, val title: String, val score: Double, val reason: String)
data class LaneResponse(val builtAt: Long, val rows: List<LaneJson>)

@RestController
class InterestController(
    private val user: IdentityUser,
    private val service: InterestService,
    private val candidates: CandidateService,
    private val lane: PromotionLaneService,
) {
    @GetMapping("/interests", headers = ["X-Api-Version=1"])
    fun list(): List<InterestJson> = service.list(user.id).map {
        InterestJson(it.id.toString(), it.kind, it.label, it.key, it.weight, it.origin, it.enabled)
    }

    @PostMapping("/interests/import", headers = ["X-Api-Version=1"])
    fun import(@RequestBody body: ImportRequest): ImportResponse =
        service.import(user.id, body.topics ?: "", body.sources ?: "")

    @PostMapping("/interests/candidates", headers = ["X-Api-Version=1"])
    fun candidates(@RequestBody body: CandidateRequest): CandidateResponse =
        CandidateResponse(candidates.candidates(body.labels))

    @GetMapping("/interests/lane", headers = ["X-Api-Version=1"])
    fun lane(): LaneResponse {
        val r = lane.build(user.id)
        return LaneResponse(r.builtAt, r.rows.map { LaneJson(it.articleId, it.title, it.score, it.reason) })
    }
}
