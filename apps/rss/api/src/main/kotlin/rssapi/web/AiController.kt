package rssapi.web

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.ai.AiService
import rssapi.ai.SummaryLength

data class AiStatusJson(val available: Boolean, val provider: String, val model: String)

data class AiSummarizeBody(val title: String?, val text: String?, val length: String? = null)

data class AiSummaryJson(val summary: String)

@RestController
class AiController(
    private val user: IdentityUser,
    private val ai: AiService,
) {
    @GetMapping("/ai/status", headers = ["X-Api-Version=1"])
    fun status(): AiStatusJson {
        val status = ai.status()
        return AiStatusJson(status.available, status.provider, status.model)
    }

    @PostMapping("/ai/summarize", headers = ["X-Api-Version=1"])
    fun summarize(@RequestBody body: AiSummarizeBody): AiSummaryJson {
        val text = body.text ?: throw ApiException(400, "text is required")
        val length = SummaryLength.parse(body.length)
        return AiSummaryJson(ai.summarize(user.id, body.title, text, length))
    }
}
