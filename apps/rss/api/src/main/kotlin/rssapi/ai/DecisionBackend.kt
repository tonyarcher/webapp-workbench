package rssapi.ai

import com.fasterxml.jackson.databind.JsonNode

const val DECISION_DEFAULT_BASE: String = "https://api.typesafe.ai"
const val DECISION_DEFAULT_MODEL: String = "jev-latest"

/**
 * Decision model (TypeSafe System One) over HTTPS. Auth is a Bearer key that
 * arrives only via the TYPESAFE_API_KEY env var; it is never logged and never
 * leaves this backend except as an Authorization header. Every failure
 * surfaces as [AiException] with the status in the message; there are no
 * retries here because the front-page caller falls back to signals.
 */
class DecisionBackend(private val config: AiConfig, private val http: HttpPoster = JdkHttpPoster()) {
    fun probe(): Boolean {
        if (config.decisionApiKey.isBlank()) return false
        return try {
            val res = http.get(base() + "/v1/models", authHeaders(), config.probeTimeoutMs)
            if (res.status !in 200..299) {
                false
            } else {
                parseBody(res.body, "decision models")
                true
            }
        } catch (_: AiException) {
            false
        } catch (_: IllegalArgumentException) {
            false
        } catch (_: java.io.IOException) {
            false
        } catch (_: RuntimeException) {
            false
        }
    }

    /**
     * Evaluate [questions] against [state] (a JSON document) and return the
     * `answers` node keyed by question id. Throws [AiException] on transport
     * errors, non-2xx statuses, malformed JSON, or a missing answers node.
     */
    fun score(state: String, questions: Map<String, Any>): JsonNode {
        val body = jsonBody(
            mapOf(
                "model" to model(),
                "state" to parseBody(state, "decision state"),
                "questions" to questions,
            ),
        )
        val res = http.post(
            base() + "/v1/systemone",
            authHeaders() + mapOf("Content-Type" to "application/json"),
            body,
            config.timeoutMs,
        )
        val parsed = parseBody(requireOk(res, "decision systemone"), "decision systemone")
        if (parsed.path("answers").isMissingNode) throw AiException("decision response had no answers")
        return parsed.path("answers")
    }

    private fun base(): String = config.baseUrl.ifEmpty { DECISION_DEFAULT_BASE }

    private fun model(): String = config.model.ifEmpty { DECISION_DEFAULT_MODEL }

    private fun authHeaders(): Map<String, String> = mapOf("Authorization" to "Bearer ${config.decisionApiKey}")
}
