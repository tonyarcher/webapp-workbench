package timesupapi.interests

import org.springframework.stereotype.Service
import timesupapi.scrape.FeedDiscoveryService
import java.time.Instant
import java.util.UUID

private const val SOURCE_CONFIDENCE_VALIDATED = 0.8
private const val SOURCE_CONFIDENCE_UNVALIDATED = 0.2

@Service
class SourceService(
    private val repo: SourceRepo,
    private val resolver: ResolutionService,
    private val discovery: FeedDiscoveryService,
) {
    fun importSources(userId: UUID, labels: List<String>): List<SourceEntity> {
        val out = mutableListOf<SourceEntity>()
        for (label in labels) {
            val key = label.trim().lowercase()
            if (key.isNotEmpty()) {
                val existing = repo.findByUserIdAndKey(userId, key)
                if (existing != null) {
                    out.add(existing)
                } else {
                    out.add(repo.save(buildSource(userId, label, key)))
                }
            }
        }
        return out
    }

    private fun buildSource(userId: UUID, label: String, key: String): SourceEntity {
        val host = resolver.resolve(label)
        val entity = SourceEntity(
            userId = userId,
            label = label.trim(),
            key = key,
            host = host,
            resolved = host != null,
            lastCheckedAt = Instant.now(),
        )
        if (host != null) validate(entity, host)
        return entity
    }

    private fun validate(entity: SourceEntity, host: String) {
        try {
            val result = discovery.discover("https://$host")
            if (result.feeds.isNotEmpty()) {
                entity.validated = true
                entity.confidence = SOURCE_CONFIDENCE_VALIDATED
            } else {
                entity.validated = false
                entity.confidence = SOURCE_CONFIDENCE_UNVALIDATED
            }
        } catch (_: Exception) {
            entity.validated = false
            entity.confidence = SOURCE_CONFIDENCE_UNVALIDATED
        }
    }

    fun list(userId: UUID): List<SourceEntity> = repo.findByUserId(userId)

    fun validated(userId: UUID): List<SourceEntity> = repo.findByUserId(userId).filter { it.validated }
}
