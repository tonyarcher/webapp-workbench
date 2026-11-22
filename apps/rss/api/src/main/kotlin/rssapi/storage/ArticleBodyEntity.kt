package rssapi.storage
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "article_bodies")
class ArticleBodyEntity(
    @Id
    @Column(name = "article_id")
    var articleId: String = "",
    @Column(name = "content_html")
    var contentHtml: String? = null,
    @Column(name = "storage_key")
    var storageKey: String? = null,
    @Column(name = "byte_size")
    var byteSize: Long? = null,
)
