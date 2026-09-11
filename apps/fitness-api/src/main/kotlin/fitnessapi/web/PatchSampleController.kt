package fitnessapi.web

import com.fasterxml.jackson.databind.JsonNode
import org.springframework.beans.factory.ObjectProvider
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import fitnessapi.LOCAL_USER_ID
import fitnessapi.store.SampleStore
import fitnessapi.store.StoredSample

@RestController
class PatchSampleController(private val samples: ObjectProvider<SampleStore>) {
    @PatchMapping("/samples")
    fun patch(@RequestBody body: JsonNode): Any {
        val metric = body.string("metric")
        val originId = body.string("originId")
        if (metric == null || originId == null) throw ApiException(400, "metric and originId required")
        val store = samples.orOffline()
        val row = store.findByOrigin(LOCAL_USER_ID, metric, originId)
            ?: throw ApiException(404, "sample not found")
        return applyPatch(store, row, body.jsonNumber("valueSi"), body.bool("hidden") == true, body.string("note"))
    }
}

private fun applyPatch(
    store: SampleStore,
    row: StoredSample,
    valueSi: Double?,
    hidden: Boolean,
    note: String?,
): Any {
    if (valueSi != null) {
        if (!valueSi.isFinite()) throw ApiException(400, "valueSi must be finite")
        store.applyOverride(LOCAL_USER_ID, row, valueSi, note)
        return OkOverridden(ok = true, overridden = true)
    }
    if (hidden) {
        store.hideSample(LOCAL_USER_ID, row, note)
        return OkHidden(ok = true, hidden = true)
    }
    throw ApiException(400, "valueSi or hidden required")
}
