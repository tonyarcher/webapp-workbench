package timesupapi.interests

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import timesupapi.platform.IdentityUser
import java.util.UUID

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

data class FeedbackRequest(val interestKey: String, val action: String)
data class FeedbackResponse(val interestKey: String, val newWeight: Double)

data class EditInterestRequest(
    val id: String,
    val label: String? = null,
    val weight: Double? = null,
    val enabled: Boolean? = null,
    val kind: String? = null,
)
data class AddInterestRequest(val kind: String, val label: String)
data class ForgetInterestRequest(val id: String, val reason: String = "")

@RestController
class InterestController(
    private val user: IdentityUser,
    private val service: InterestService,
    private val candidates: CandidateService,
    private val lane: PromotionLaneService,
    private val feedback: InterestFeedbackService,
    private val editor: InterestEditorService,
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

    @PostMapping("/interests/feedback", headers = ["X-Api-Version=1"])
    fun feedback(@RequestBody body: FeedbackRequest): FeedbackResponse =
        FeedbackResponse(body.interestKey, feedback.feedback(user.id, body.interestKey, body.action))

    @PostMapping("/interests/edit", headers = ["X-Api-Version=1"])
    fun edit(@RequestBody body: EditInterestRequest): Map<String, Boolean> {
        val id = UUID.fromString(body.id)
        var ok = true
        body.label?.let { if (!editor.rename(user.id, id, it)) ok = false }
        body.weight?.let { if (!editor.setWeight(user.id, id, it)) ok = false }
        body.enabled?.let { if (!editor.setEnabled(user.id, id, it)) ok = false }
        body.kind?.let { if (!editor.changeKind(user.id, id, it)) ok = false }
        return mapOf("ok" to ok)
    }

    @PostMapping("/interests/add", headers = ["X-Api-Version=1"])
    fun add(@RequestBody body: AddInterestRequest): Map<String, String?> {
        val row = editor.addManual(user.id, body.kind, body.label)
        return mapOf("id" to row?.id?.toString())
    }

    @PostMapping("/interests/forget", headers = ["X-Api-Version=1"])
    fun forget(@RequestBody body: ForgetInterestRequest): Map<String, Boolean> {
        val id = UUID.fromString(body.id)
        return mapOf("ok" to editor.forget(user.id, id))
    }
}
