package rssapi.ai

/**
 * opencode serve (see opencode.ai/docs/server). Sessions are created per
 * summary and deleted after: nothing accumulates on the model host. The
 * message carries a wildcard deny-all tools map, so the run cannot touch
 * files, run commands, or call anything but the model; the ops side should
 * additionally lock the service config down. Credentials stay in the
 * untracked .env as basic-auth pairs.
 */
class OpenCodeBackend(
    private val config: AiConfig,
    private val http: HttpPoster = JdkHttpPoster(),
) : AiBackend {
    override fun probe(): Boolean {
        if (config.baseUrl.isEmpty() || config.model.isEmpty()) return false
        return try {
            val health = http.get(config.baseUrl + "/global/health", authHeaders(), config.probeTimeoutMs)
            val parsed = parseBody(requireOk(health, "opencode health"), "opencode health")
            if (!parsed.path("healthy").asBoolean(false)) return false
            providerOf(config.model) in connectedProviders()
        } catch (_: AiException) {
            false
        } catch (_: IllegalArgumentException) {
            false
        }
    }

    override fun summarize(system: String, text: String): String {
        val (providerId, modelId) = splitModel(config.model)
        val sessionId = createSession()
        try {
            return sendMessage(sessionId, providerId, modelId, system, text)
        } finally {
            deleteSession(sessionId)
        }
    }

    private fun authHeaders(): Map<String, String> = basicAuth(config.basicUser, config.basicPassword)

    private fun connectedProviders(): Set<String> {
        val res = http.get(config.baseUrl + "/provider", authHeaders(), config.probeTimeoutMs)
        return parseBody(requireOk(res, "opencode providers"), "opencode providers")
            .path("connected").map { it.asText() }.toSet()
    }

    private fun createSession(): String {
        val res = http.post(
            config.baseUrl + "/session",
            authHeaders() + mapOf("Content-Type" to "application/json"),
            jsonBody(mapOf("title" to "rss summarize")),
            config.timeoutMs,
        )
        val id = parseBody(requireOk(res, "opencode session"), "opencode session").path("id").asText()
        if (id.isEmpty()) throw AiException("opencode session had no id")
        return id
    }

    private fun sendMessage(
        sessionId: String,
        providerId: String,
        modelId: String,
        system: String,
        text: String,
    ): String {
        val body = jsonBody(
            mapOf(
                "model" to mapOf("providerID" to providerId, "modelID" to modelId),
                "system" to system,
                "tools" to mapOf("*" to false),
                "parts" to listOf(mapOf("type" to "text", "text" to text)),
            ),
        )
        val res = http.post(
            "${config.baseUrl}/session/$sessionId/message",
            authHeaders() + mapOf("Content-Type" to "application/json"),
            body,
            config.timeoutMs,
        )
        return extractText(requireOk(res, "opencode message"))
    }

    private fun deleteSession(sessionId: String) {
        try {
            http.delete("${config.baseUrl}/session/$sessionId", authHeaders(), config.timeoutMs)
        } catch (_: AiException) {
            // Hygiene only; a stale session on the model host is harmless.
        } catch (_: java.io.IOException) {
            // Hygiene only; a stale session on the model host is harmless.
        }
    }

    companion object {
        fun splitModel(model: String): Pair<String, String> {
            val cut = model.indexOf('/')
            if (cut <= 0 || cut == model.length - 1) throw AiException("AI_MODEL must look like provider/model")
            return model.take(cut) to model.drop(cut + 1)
        }

        fun providerOf(model: String): String = splitModel(model).first

        fun extractText(body: String): String {
            val text = parseBody(body, "opencode message").path("parts")
                .filter { it.path("type").asText() == "text" }
                .joinToString("\n") { it.path("text").asText() }.trim()
            if (text.isEmpty()) throw AiException("opencode returned no text")
            return text
        }
    }
}
