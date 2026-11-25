package timesupapi.interests

import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

@Service
class ImportBatchService(private val repo: ImportBatchRepo) {
    fun start(userId: UUID, fingerprint: String, parsed: Int): ImportBatchEntity {
        val existing = repo.findByFingerprint(fingerprint)
        if (existing != null) return existing
        return repo.save(
            ImportBatchEntity(
                userId = userId,
                fingerprint = fingerprint,
                state = "running",
                parsed = parsed,
                pending = parsed,
            ),
        )
    }

    fun progress(batchId: UUID, resolved: Int, discovered: Int, failed: Int, pending: Int) {
        val row = repo.findById(batchId).orElse(null) ?: return
        row.resolved = resolved
        row.discovered = discovered
        row.failed = failed
        row.pending = pending
        row.updatedAt = Instant.now()
        repo.save(row)
    }

    fun complete(batchId: UUID) {
        val row = repo.findById(batchId).orElse(null) ?: return
        row.state = "done"
        row.updatedAt = Instant.now()
        repo.save(row)
    }

    fun cancel(batchId: UUID) {
        val row = repo.findById(batchId).orElse(null) ?: return
        row.state = "stopped"
        row.updatedAt = Instant.now()
        repo.save(row)
    }

    fun status(userId: UUID): List<ImportBatchEntity> = repo.findByUserIdOrderByCreatedAtDesc(userId)
}
