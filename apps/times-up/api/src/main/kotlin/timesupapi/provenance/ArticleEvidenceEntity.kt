package timesupapi.provenance

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/** A verbatim evidence slice learned once from article text. */
@Entity
@Table(name = "article_evidence")
class ArticleEvidenceEntity(
    @Id
    var id: String = "",
    @Column(name = "article_id")
    var articleId: String = "",
    var kind: String = "",
    @Column(name = "evidence_text")
    var evidenceText: String = "",
    @Column(name = "created_at")
    var createdAt: Instant = Instant.now(),
)
