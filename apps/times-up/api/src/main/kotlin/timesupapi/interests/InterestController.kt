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

@RestController
class InterestController(private val user: IdentityUser, private val service: InterestService) {
    @GetMapping("/interests", headers = ["X-Api-Version=1"])
    fun list(): List<InterestJson> = service.list(user.id).map {
        InterestJson(it.id.toString(), it.kind, it.label, it.key, it.weight, it.origin, it.enabled)
    }

    @PostMapping("/interests/import", headers = ["X-Api-Version=1"])
    fun import(@RequestBody body: ImportRequest): ImportResponse =
        service.import(user.id, body.topics ?: "", body.sources ?: "")
}
