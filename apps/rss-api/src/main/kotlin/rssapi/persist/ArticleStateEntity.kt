package rssapi.persist

import java.io.Serializable
import java.time.Instant
import java.util.UUID
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table

data class ArticleStateId(
    var userId: UUID = UUID(0, 0),
    var articleId: String = "",
) : Serializable {
    companion object {
        private const val serialVersionUID: Long = 1
    }
}

@Entity
@Table(name = "article_state")
@IdClass(ArticleStateId::class)
class ArticleStateEntity(
    @Id @Column(name = "user_id")
    var userId: UUID = UUID(0, 0),
    @Id @Column(name = "article_id")
    var articleId: String = "",
    var read: Boolean = false,
    @Column(name = "read_at")
    var readAt: Instant? = null,
    var starred: Boolean = false,
)
