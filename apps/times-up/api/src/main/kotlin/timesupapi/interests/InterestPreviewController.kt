package timesupapi.interests

import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import timesupapi.platform.IdentityUser

data class PreviewRequest(val topics: String? = null, val sources: String? = null)
data class PreviewResponse(val fingerprint: String, val topics: ImportReport, val sources: ImportReport)

@RestController
class InterestPreviewController {
    @PostMapping("/interests/preview", headers = ["X-Api-Version=1"])
    fun preview(@RequestBody body: PreviewRequest): PreviewResponse {
        val (topicReport, _) = FollowImportParser.parse(body.topics ?: "")
        val (sourceReport, _) = FollowImportParser.parse(body.sources ?: "")
        val fingerprint = sha256((body.topics ?: "") + "\n---\n" + (body.sources ?: ""))
        return PreviewResponse(fingerprint, topicReport, sourceReport)
    }
}

private fun sha256(s: String): String {
    val md = java.security.MessageDigest.getInstance("SHA-256")
    return md.digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
}
