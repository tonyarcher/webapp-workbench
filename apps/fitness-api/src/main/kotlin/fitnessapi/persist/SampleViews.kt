package fitnessapi.persist

import java.time.Instant

interface MetricStatsView {
    fun getMetric(): String
    fun getN(): Long
    fun getFirstT(): Instant
    fun getLastT(): Instant
}

interface LatestView {
    fun getMetric(): String
    fun getT(): Instant
    fun getValueSi(): Double
}
