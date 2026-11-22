package rssapi.mcp
import org.springframework.stereotype.Component
import rssapi.feeds.LibraryService
import java.util.UUID

@Component
class McpLibraryTools(private val library: LibraryService) {
    fun feeds(userId: UUID): Any = mapOf("feeds" to library.feeds(userId))
    fun folders(userId: UUID): Any = mapOf("folders" to library.folders(userId))
}
