package stockgame.web

import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import stockgame.ai.AiConfig
import stockgame.ai.AiQuotaService
import stockgame.parse.OrderParseProvider
import stockgame.parse.ParsedOrder

data class ParseOrderBody(val text: String?)

data class ParseOrderJson(
    val intent: Boolean,
    val side: String,
    val symbol: String?,
    val qty: Int?,
    val method: String,
)

/**
 * Natural-language order parse. The model judges intent and side behind the
 * per-user quota when `AI_PROVIDER=decision` with a key; symbol and quantity
 * are heuristic slots the trade form confirms. Unknown or low-intent text
 * routes to the manual form. Nothing here executes a trade.
 */
@RestController
class ParseController(
    private val user: IdentityUser,
    private val aiConfig: AiConfig,
    private val quotas: AiQuotaService,
    private val provider: OrderParseProvider,
) {
    @PostMapping("/orders/parse", headers = ["X-Api-Version=1"])
    fun parse(@RequestBody body: ParseOrderBody): ParseOrderJson {
        val text = body.text?.trim().orEmpty()
        if (text.isEmpty()) badRequest("missing text")
        if (text.length > aiConfig.maxInputChars) throw ApiException(HTTP_PAYLOAD_TOO_LARGE, "text too large")
        val enabled = aiConfig.provider == "decision" && aiConfig.decisionApiKey.isNotEmpty()
        if (!enabled) return json(stockgame.parse.codeOnly(text))
        quotas.consume(user.id, aiConfig.hourlyLimit, aiConfig.dailyLimit)
        return try {
            json(provider.parse(text))
        } catch (_: Exception) {
            json(stockgame.parse.codeOnly(text))
        }
    }
}

private fun json(parsed: ParsedOrder): ParseOrderJson =
    ParseOrderJson(parsed.intent, parsed.side, parsed.symbol, parsed.qty, parsed.method)

private fun badRequest(message: String): Nothing = throw ApiException(HttpStatus.BAD_REQUEST, message)

private val HTTP_PAYLOAD_TOO_LARGE: HttpStatusCode = HttpStatusCode.valueOf(HTTP_PAYLOAD_TOO_LARGE_STATUS)

private const val HTTP_PAYLOAD_TOO_LARGE_STATUS: Int = 413
