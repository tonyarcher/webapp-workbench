package rssapi.edition

import org.springframework.stereotype.Component

/**
 * Phase B attach point for Jev enrichment. Phase A wires [SignalEnrichment]
 * (honest no-ops); Phase B adds a Jev-backed implementation behind this same
 * interface without touching [EditionService]. No Jev code lives here.
 */
interface EditionEnrichment {
    /** A topic label for one cluster, or null when the provider abstains. */
    fun topic(clusterTitles: List<String>): String?

    /** Whether two clusters cover the same story and should merge. */
    fun mergeJudgment(aTitles: List<String>, bTitles: List<String>): Boolean

    /** Per-claim verification against the cluster evidence; empty when unverified. */
    fun verifyClaims(clusterId: String, claims: List<String>, evidence: List<String>): Map<String, Boolean>
}

/** Phase A provider: abstains everywhere so the edition stays purely signal-driven. */
@Component
class SignalEnrichment : EditionEnrichment {
    override fun topic(clusterTitles: List<String>): String? = null
    override fun mergeJudgment(aTitles: List<String>, bTitles: List<String>): Boolean = false
    override fun verifyClaims(clusterId: String, claims: List<String>, evidence: List<String>): Map<String, Boolean> =
        emptyMap()
}
