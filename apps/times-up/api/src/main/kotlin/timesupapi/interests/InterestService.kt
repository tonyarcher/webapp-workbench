package timesupapi.interests

import org.springframework.stereotype.Service
import java.security.MessageDigest
import java.time.Clock
import java.time.Instant
import java.util.UUID

private const val MAX_WEIGHT = 10.0
private const val UPDATE_FACTOR = 0.5
private const val REPEAT_WEIGHT = 0.1
private const val MAX_INITIAL_WEIGHT = 5.0
private const val MIN_WEIGHT = 0.01

@Service
class InterestService(private val repo: InterestRepo) {
    internal var clock: Clock = Clock.systemUTC()

    fun import(userId: UUID, topics: String, sources: String): ImportResponse {
        val (topicReport, topicLabels) = FollowImportParser.parse(topics)
        val (sourceReport, sourceLabels) = FollowImportParser.parse(sources)
        val now = clock.instant()
        for ((i, pl) in topicLabels.withIndex()) {
            upsert(userId, InterestKind.TOPIC, pl, i, now)
        }
        for ((i, pl) in sourceLabels.withIndex()) {
            upsert(userId, InterestKind.SOURCE, pl, i, now)
        }
        val fingerprint = sha256(topics + "\n---\n" + sources)
        return ImportResponse(fingerprint, topicReport, sourceReport)
    }

    private fun upsert(userId: UUID, kind: InterestKind, pl: ParsedLabel, position: Int, now: Instant) {
        val existing = repo.findByUserIdAndKindAndKey(userId, kind.name, pl.key)
        val weight = initialWeight(position, pl.count)
        if (existing == null) {
            repo.save(
                InterestEntity(
                    userId = userId,
                    kind = kind.name,
                    label = pl.display,
                    key = pl.key,
                    weight = weight,
                    origin = "import",
                    createdAt = now,
                ),
            )
        } else {
            existing.weight = (existing.weight + weight * UPDATE_FACTOR).coerceAtMost(MAX_WEIGHT)
            existing.label = pl.display
            repo.save(existing)
        }
    }

    fun list(userId: UUID): List<InterestEntity> = repo.findByUserIdOrderByWeightDesc(userId)

    fun decay(userId: UUID, halfLifeDays: Int = 30) {
        val now = clock.instant()
        val rows = repo.findByUserIdAndEnabled(userId, true)
        for (r in rows) {
            val last = r.lastHitAt ?: r.createdAt
            val days = java.time.Duration.between(last, now).toDays().toDouble()
            if (days <= 0) continue
            val factor = Math.pow(0.5, days / halfLifeDays)
            r.weight = (r.weight * factor).coerceAtLeast(MIN_WEIGHT)
            repo.save(r)
        }
    }

    private fun initialWeight(position: Int, repeat: Int): Double {
        val posWeight = 1.0 / (position + 1).toDouble()
        val repeatWeight = repeat.toDouble()
        return (posWeight + repeatWeight * REPEAT_WEIGHT).coerceAtMost(MAX_INITIAL_WEIGHT)
    }

    private fun sha256(s: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        return md.digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }
}
