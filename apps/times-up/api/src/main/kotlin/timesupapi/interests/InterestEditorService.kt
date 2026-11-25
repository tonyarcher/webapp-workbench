package timesupapi.interests

import org.springframework.stereotype.Service
import java.util.UUID

private const val MIN_W = 0.01
private const val MAX_W = 10.0

@Service
class InterestEditorService(private val repo: InterestRepo) {
    fun rename(userId: UUID, interestId: UUID, newLabel: String): Boolean {
        val row = repo.findById(interestId).orElse(null) ?: return false
        if (row.userId != userId) return false
        row.label = newLabel.trim()
        repo.save(row)
        return true
    }

    fun setWeight(userId: UUID, interestId: UUID, weight: Double): Boolean {
        val row = repo.findById(interestId).orElse(null) ?: return false
        if (row.userId != userId) return false
        row.weight = weight.coerceIn(MIN_W, MAX_W)
        repo.save(row)
        return true
    }

    fun setEnabled(userId: UUID, interestId: UUID, enabled: Boolean): Boolean {
        val row = repo.findById(interestId).orElse(null) ?: return false
        if (row.userId != userId) return false
        row.enabled = enabled
        repo.save(row)
        return true
    }

    fun changeKind(userId: UUID, interestId: UUID, kind: String): Boolean {
        val row = repo.findById(interestId).orElse(null) ?: return false
        if (row.userId != userId) return false
        if (kind !in listOf("TOPIC", "ENTITY", "PLACE", "SOURCE")) return false
        row.kind = kind
        repo.save(row)
        return true
    }

    fun forget(userId: UUID, interestId: UUID): Boolean {
        val row = repo.findById(interestId).orElse(null) ?: return false
        if (row.userId != userId) return false
        repo.delete(row)
        return true
    }

    fun addManual(userId: UUID, kind: String, label: String): InterestEntity? {
        if (kind !in listOf("TOPIC", "ENTITY", "PLACE", "SOURCE")) return null
        val key = label.trim().lowercase()
        val existing = repo.findByUserIdAndKindAndKey(userId, kind, key)
        if (existing != null) return existing
        val row = InterestEntity(
            userId = userId,
            kind = kind,
            label = label.trim(),
            key = key,
            weight = 1.0,
            origin = "manual",
        )
        return repo.save(row)
    }
}
