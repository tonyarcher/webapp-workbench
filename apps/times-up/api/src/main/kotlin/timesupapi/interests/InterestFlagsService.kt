package timesupapi.interests

import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

data class InterestFlags(
    val importEnabled: Boolean,
    val resolutionEnabled: Boolean,
    val sensorsEnabled: Boolean,
    val promotionEnabled: Boolean,
)

@Service
class InterestFlagsService {
    fun flags(): InterestFlags = InterestFlags(
        importEnabled = env("INTERESTS_IMPORT_ENABLED", true),
        resolutionEnabled = env("INTERESTS_RESOLUTION_ENABLED", true),
        sensorsEnabled = env("INTERESTS_SENSORS_ENABLED", true),
        promotionEnabled = env("INTERESTS_PROMOTION_ENABLED", true),
    )

    private fun env(name: String, default: Boolean): Boolean =
        System.getenv(name)?.trim()?.lowercase() == "true" || (System.getenv(name) == null && default)
}
