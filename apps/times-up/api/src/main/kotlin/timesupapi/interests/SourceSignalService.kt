package timesupapi.interests

import org.springframework.stereotype.Service
import java.util.UUID

private const val SOURCE_BOOST = 0.1

@Service
class SourceSignalService(private val sources: SourceRepo) {
    fun followedSourceBoost(userId: UUID): Pair<Double, String?> {
        val validated = sources.findByUserId(userId).filter { it.validated && it.host != null }
        if (validated.isEmpty()) return 0.0 to null
        return SOURCE_BOOST to "followed source"
    }
}
