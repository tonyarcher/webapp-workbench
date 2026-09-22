package rssapi.ai

import java.util.UUID
import org.springframework.stereotype.Service
import rssapi.log.log
import rssapi.web.ApiException

data class AiStatus(val provider: String, val model: String, val available: Boolean)

const val AI_SYSTEM_PROMPT: String = "You summarize news articles concisely and neutrally. Never invent facts."

/** Summary length contract for `POST /ai/summarize`. Absent means standard; anything else is 400. */
enum class SummaryLength {
    BRIEF,
    STANDARD,
    DEEP,
    ;

    companion object {
        fun parse(raw: String?): SummaryLength = when (raw) {
            null -> STANDARD
            "brief" -> BRIEF
            "standard" -> STANDARD
            "deep" -> DEEP
            else -> throw ApiException(400, "invalid length")
        }
    }
}

/**
 * Server AI summarization behind the admin provider setting. Prompts and
 * article text never reach logs; only counts and durations do.
 */
@Service
class AiService(
    private val quotas: AiQuotaService,
    private val config: AiConfig = aiConfigFromEnv(),
    private val poster: HttpPoster = JdkHttpPoster(),
) {
    fun status(): AiStatus {
        val backend = backend() ?: return AiStatus(config.provider, config.model, false)
        return AiStatus(config.provider, config.model, probeQuietly(backend))
    }

    fun summarize(userId: UUID, title: String?, text: String, length: SummaryLength = SummaryLength.STANDARD): String {
        val input = cleanInput(text)
        val backend = requiredBackend()
        quotas.consume(userId, config.hourlyLimit, config.dailyLimit)
        val started = System.currentTimeMillis()
        try {
            val system = when (length) {
                SummaryLength.BRIEF -> "$AI_SYSTEM_PROMPT Summarize in exactly 3 short bullet points."
                SummaryLength.STANDARD -> AI_SYSTEM_PROMPT
                SummaryLength.DEEP -> "$AI_SYSTEM_PROMPT Summarize in 8-10 short bullet points."
            }
            val prompt = if (title.isNullOrBlank()) input else "Title: ${title.trim()}\n\n$input"
            val summary = requireText(backend.summarize(system, prompt).trim())
            logAi("summarize ok", input.length, elapsed(started))
            return summary
        } catch (err: ApiException) {
            throw err
        } catch (err: AiException) {
            logAi("summarize failed", input.length, elapsed(started))
            throw ApiException(502, "server AI failed", err)
        }
    }

    private fun requireText(summary: String): String {
        if (summary.isEmpty()) throw AiException("empty reply")
        return summary
    }

    private fun cleanInput(text: String): String {
        val input = text.trim().take(config.maxInputChars).trim()
        if (input.isEmpty()) throw ApiException(400, "text is required")
        return input
    }

    private fun requiredBackend(): AiBackend =
        backend() ?: throw ApiException(503, "server AI is not configured")

    private fun backend(): AiBackend? = when (config.provider) {
        "ollama" -> OllamaBackend(config, poster)
        "opencode" -> OpenCodeBackend(config, poster)
        else -> null
    }

    private fun probeQuietly(backend: AiBackend): Boolean = try {
        backend.probe()
    } catch (_: AiException) {
        false
    } catch (_: IllegalArgumentException) {
        false
    }

    private fun elapsed(started: Long): Long = System.currentTimeMillis() - started

    private fun logAi(msg: String, inputChars: Int, durationMs: Long) {
        log(
            "rss-api",
            "info",
            msg,
            mapOf(
                "provider" to config.provider,
                "input_chars" to inputChars.toString(),
                "duration_ms" to durationMs.toString(),
            ),
        )
    }
}
