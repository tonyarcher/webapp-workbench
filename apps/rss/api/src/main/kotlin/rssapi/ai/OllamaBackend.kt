package rssapi.ai

/** Ollama over its OpenAI-compatible API. No auth; model tags are plain names. */
class OllamaBackend(
    private val config: AiConfig,
    private val http: HttpPoster = JdkHttpPoster(),
) : AiBackend {
    override fun probe(): Boolean {
        if (config.baseUrl.isEmpty() || config.model.isEmpty()) return false
        return try {
            val root = http.get(config.baseUrl + "/", emptyMap(), config.probeTimeoutMs)
            if (root.status != 200) return false
            listedModels().any { it == config.model || it.startsWith(config.model + ":") }
        } catch (_: AiException) {
            false
        } catch (_: IllegalArgumentException) {
            false
        }
    }

    override fun summarize(system: String, text: String): String {
        val body = jsonBody(
            mapOf(
                "model" to config.model,
                "stream" to false,
                "messages" to listOf(
                    mapOf("role" to "system", "content" to system),
                    mapOf("role" to "user", "content" to text),
                ),
            ),
        )
        val res = http.post(
            config.baseUrl + "/v1/chat/completions",
            mapOf("Content-Type" to "application/json"),
            body,
            config.timeoutMs,
        )
        return extractText(requireOk(res, "ollama chat"))
    }

    private fun listedModels(): List<String> {
        val res = http.get(config.baseUrl + "/api/tags", emptyMap(), config.probeTimeoutMs)
        return parseBody(requireOk(res, "ollama tags"), "ollama tags").path("models")
            .map { it.path("name").asText() }
    }

    companion object {
        fun extractText(body: String): String {
            val text = parseBody(body, "ollama chat").path("choices").firstOrNull()
                ?.path("message")?.path("content")?.asText().orEmpty().trim()
            if (text.isEmpty()) throw AiException("ollama returned no text")
            return text
        }
    }
}
