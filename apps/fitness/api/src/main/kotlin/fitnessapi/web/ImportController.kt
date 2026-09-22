package fitnessapi.web

import tools.jackson.databind.JsonNode
import org.springframework.beans.factory.ObjectProvider
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import fitnessapi.LOCAL_USER_ID
import fitnessapi.domain.MAX_IMPORT_ROWS
import fitnessapi.domain.asSample
import fitnessapi.domain.collectSamples
import fitnessapi.domain.sampleSource
import fitnessapi.store.SampleStore

@RestController
class ImportController(private val samples: ObjectProvider<SampleStore>) {
    @PostMapping("/imports", headers = ["X-Api-Version=1"])
    fun importSamples(@RequestBody(required = false) body: JsonNode?): ImportJson {
        val raw = body?.get("samples")
        val size = if (raw != null && raw.isArray) raw.size() else 0
        if (size > MAX_IMPORT_ROWS) {
            throw ApiException(400, "at most $MAX_IMPORT_ROWS samples per request")
        }
        val incoming = if (raw != null && raw.isArray) {
            // Jackson 3 ArrayNode.map is not Kotlin's map.
            (0 until raw.size()).map { index -> parseIncoming(raw.get(index)) }
        } else {
            emptyList()
        }
        val collected = collectSamples(incoming)
        val result = samples.orOffline().importSamples(
            LOCAL_USER_ID,
            collected.samples,
            sampleSource(body?.string("source")),
            collected.errorCount,
            collected.errors,
        )
        return ImportJson(result.importId, result.stored, result.skipped, result.errors)
    }
}

private fun parseIncoming(node: JsonNode) = asSample(
    metricRaw = node.string("metric"),
    t = node.numberLike("t"),
    valueSi = node.numberLike("valueSi"),
    source = node.string("source"),
    originId = node.string("originId"),
)
