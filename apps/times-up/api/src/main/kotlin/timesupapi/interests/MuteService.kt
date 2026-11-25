package timesupapi.interests

import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

@Service
class MuteService(private val repo: MuteRuleRepo) {
    fun sync(userId: UUID, rules: List<MuteRuleJson>) {
        repo.deleteByUserId(userId)
        for (r in rules) {
            repo.save(
                MuteRuleEntity(
                    userId = userId,
                    terms = r.terms.joinToString("\n"),
                    matchTarget = r.match,
                    enabled = r.enabled,
                    scopeKind = r.scope.kind,
                    scopeFolders = if (r.scope.kind == "folders") r.scope.folderIds.joinToString(",") else null,
                    updatedAt = Instant.now(),
                ),
            )
        }
    }

    fun list(userId: UUID): List<MuteRuleEntity> = repo.findByUserId(userId)

    fun veto(userId: UUID, articleTitle: String, articleBody: String?, folderId: UUID?): Boolean {
        val rules = repo.findByUserId(userId).filter { it.enabled }
        return rules.any { ruleMatches(it, articleTitle, articleBody, folderId) }
    }

    private fun ruleMatches(
        rule: MuteRuleEntity,
        articleTitle: String,
        articleBody: String?,
        folderId: UUID?,
    ): Boolean {
        if (rule.scopeKind == "folders" && folderId != null) {
            val folders = rule.scopeFolders?.split(",")?.toSet() ?: emptySet()
            if (folderId.toString() !in folders) return false
        }
        val terms = rule.terms.lines().map { it.trim() }.filter { it.isNotEmpty() }
        val haystack = when (rule.matchTarget) {
            "title" -> articleTitle
            "body" -> articleBody ?: ""
            else -> "$articleTitle ${articleBody ?: ""}"
        }.lowercase()
        return terms.any { haystack.contains(it.lowercase()) }
    }
}

data class MuteRuleJson(val terms: List<String>, val match: String, val enabled: Boolean, val scope: MuteScopeJson)

data class MuteScopeJson(val kind: String, val folderIds: List<String> = emptyList())
