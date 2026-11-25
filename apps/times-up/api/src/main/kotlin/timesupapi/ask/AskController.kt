package timesupapi.ask

import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import timesupapi.platform.IdentityUser

const val ASK_DEFAULT_LIMIT: Int = 8

data class AskRequest(val question: String, val scope: String? = null, val limit: Int? = null)
data class AskResult(val articleId: String, val title: String, val text: String, val score: Double)
data class AskResponse(val question: String, val results: List<AskResult>)

@RestController
class AskController(private val user: IdentityUser, private val service: AskService) {
    @PostMapping("/ask", headers = ["X-Api-Version=1"])
    fun ask(@RequestBody body: AskRequest): AskResponse {
        val q = body.question.trim()
        if (q.isEmpty()) {
            throw timesupapi.platform.ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "question required",
            )
        }
        return AskResponse(q, service.ask(user.id, q, body.limit ?: ASK_DEFAULT_LIMIT))
    }
}
