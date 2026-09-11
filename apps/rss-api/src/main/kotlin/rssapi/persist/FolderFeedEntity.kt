package rssapi.persist

import java.io.Serializable
import java.util.UUID
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table

data class FolderFeedId(
    var folderId: UUID = UUID(0, 0),
    var feedId: UUID = UUID(0, 0),
) : Serializable {
    companion object {
        private const val serialVersionUID: Long = 1
    }
}

@Entity
@Table(name = "folder_feeds")
@IdClass(FolderFeedId::class)
class FolderFeedEntity(
    @Id @Column(name = "folder_id")
    var folderId: UUID = UUID(0, 0),
    @Id @Column(name = "feed_id")
    var feedId: UUID = UUID(0, 0),
)
