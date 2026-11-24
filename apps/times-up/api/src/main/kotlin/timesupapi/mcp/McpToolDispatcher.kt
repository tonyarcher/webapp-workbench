package timesupapi.mcp
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import timesupapi.platform.ApiException
import java.util.UUID

/** Routes one tool call to a fixed executor. Write tools need consent and confirm. */
@Component
class McpToolDispatcher(
    private val library: McpLibraryTools,
    private val articles: McpArticleTools,
    private val write: McpWriteTools,
) {
    fun execute(client: McpPrincipal, name: String, args: Map<String, Any?>): Any {
        val uid = client.userId
        return when (name) {
            "list_feeds" -> library.feeds(uid)
            "list_folders" -> library.folders(uid)
            "search_articles" -> articles.search(uid, text(args, "q"))
            "open_summary" -> articles.summary(uid, text(args, "articleId"))
            "fetch_body" -> articles.body(uid, text(args, "articleId"))
            "quote_highlight" -> articles.quote(uid, text(args, "articleId"))
            "star_article", "save_for_later", "add_to_board" -> writeWithConsent(client, name, args, uid)
            else -> throw ApiException(HttpStatus.BAD_REQUEST, "unknown tool")
        }
    }

    private fun writeWithConsent(client: McpPrincipal, name: String, args: Map<String, Any?>, uid: UUID): Any {
        if (!client.writesEnabled) throw ApiException(HttpStatus.FORBIDDEN, "write tools require client consent")
        if (text(args, "confirm") !=
            name
        ) {
            throw ApiException(HttpStatus.BAD_REQUEST, "confirm must equal the tool name")
        }
        val articleId = text(args, "articleId")
        return when (name) {
            "star_article" -> write.star(uid, articleId)
            "save_for_later" -> write.save(uid, articleId)
            else -> write.board(uid, articleId, text(args, "boardId"))
        }
    }

    private fun text(args: Map<String, Any?>, key: String): String =
        args[key]?.toString()?.trim()?.takeIf { it.isNotEmpty() }
            ?: throw ApiException(HttpStatus.BAD_REQUEST, "$key is required")
}
