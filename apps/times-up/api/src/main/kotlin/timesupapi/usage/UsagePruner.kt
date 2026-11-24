package timesupapi.usage
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.LocalDate
import java.time.ZoneOffset

private const val USAGE_RETENTION_DAYS: Long = 90

@Component
class UsagePruner(private val repo: FeatureUsageRepo) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(fixedDelayString = "\${USAGE_PRUNE_MS:86400000}")
    fun prune() {
        val cutoff = LocalDate.now(ZoneOffset.UTC).minusDays(USAGE_RETENTION_DAYS)
        val removed = repo.deleteOlderThan(cutoff)
        if (removed > 0) log.info("usage prune removed={} cutoff={}", removed, cutoff)
    }
}
