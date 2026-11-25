package timesupapi.interests

import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

data class ImportRequest(val topics: String? = null, val sources: String? = null)
data class ImportResponse(val fingerprint: String, val topics: ImportReport, val sources: ImportReport)

@RestController
class InterestController(private val service: InterestService) {
    @PostMapping("/interests/import", headers = ["X-Api-Version=1"])
    fun import(@RequestBody body: ImportRequest): ImportResponse = service.import(body.topics ?: "", body.sources ?: "")
}
