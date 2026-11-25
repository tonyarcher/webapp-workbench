package timesupapi.interests

import org.springframework.stereotype.Service
import java.time.Clock
import java.util.UUID

private const val STAR_DELTA = 1.0
private const val OPEN_DELTA = 0.2
private const val SAVE_DELTA = 0.8
private const val DISMISS_DELTA = -0.5
private const val NOT_INTERESTED_DELTA = -2.0
private const val MAX_WEIGHT = 10.0
private const val MIN_WEIGHT = 0.01

@Service
class InterestFeedbackService(private val repo: InterestRepo) {
    internal var clock: Clock = Clock.systemUTC()

    fun feedback(userId: UUID, interestKey: String, action: String): Double {
        val rows = repo.findByUserIdAndEnabled(userId, true).filter { it.key == interestKey }
        if (rows.isEmpty()) return 0.0
        val delta = when (action) {
            "star" -> STAR_DELTA
            "open" -> OPEN_DELTA
            "save" -> SAVE_DELTA
            "dismiss" -> DISMISS_DELTA
            "not_interested" -> NOT_INTERESTED_DELTA
            else -> 0.0
        }
        var newWeight = 0.0
        for (r in rows) {
            r.weight = (r.weight + delta).coerceIn(MIN_WEIGHT, MAX_WEIGHT)
            r.lastHitAt = clock.instant()
            repo.save(r)
            newWeight = r.weight
        }
        return newWeight
    }

    fun vetoedByMute(mutedKeys: Set<String>, interestKey: String): Boolean = interestKey in mutedKeys
}
