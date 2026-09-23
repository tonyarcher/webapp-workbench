package rssapi.persist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "article_scores")
class ArticleScoreEntity(
    @Id @Column(name = "article_id")
    var articleId: String = "",
    var worthy: Double? = null,
    var interest: Double? = null,
    var topic: String? = null,
    @Column(name = "popularity_outlook")
    var popularityOutlook: Double? = null,
    var readability: Double? = null,
    @Column(name = "scored_at")
    var scoredAt: Instant? = null,
    var model: String? = null,
)
