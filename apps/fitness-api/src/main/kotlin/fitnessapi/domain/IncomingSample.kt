package fitnessapi.domain

data class IncomingSample(
    val metric: String,
    val t: Long,
    val valueSi: Double,
    val source: String,
    val originId: String,
)

data class CollectedSamples(
    val samples: List<IncomingSample>,
    val errorCount: Int,
    val errors: List<String>,
)

fun sampleKey(sample: IncomingSample): String =
    "${sample.metric}|${sample.t}|${sample.source}|${sample.originId}"

fun asSample(
    metricRaw: String?,
    t: Double?,
    valueSi: Double?,
    source: String?,
    originId: String?,
): IncomingSample? {
    val metric = metricRaw?.let { parseMetricId(it) } ?: return null
    if (t == null || !t.isFinite() || valueSi == null || !valueSi.isFinite()) return null
    if (originId.isNullOrEmpty()) return null
    return IncomingSample(metric, t.toLong(), valueSi, sampleSource(source), originId)
}

fun collectSamples(items: List<IncomingSample?>): CollectedSamples {
    val byKey = linkedMapOf<String, IncomingSample>()
    val errors = mutableListOf<String>()
    var errorCount = 0
    for (sample in items) {
        if (sample != null) {
            byKey[sampleKey(sample)] = sample
            continue
        }
        errorCount += 1
        if (errors.size < 20) errors.add("invalid sample")
    }
    return CollectedSamples(byKey.values.toList(), errorCount, errors)
}
