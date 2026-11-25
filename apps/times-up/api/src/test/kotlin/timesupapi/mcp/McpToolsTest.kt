package timesupapi.mcp
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import timesupapi.platform.ApiException
import java.util.UUID

private val TOOLS_UID: UUID = UUID.fromString("44444444-4444-4444-4444-444444444444")
private val TOOLS_AID: UUID = UUID.fromString("55555555-5555-5555-5555-555555555555")

class McpToolsTest {
    private val library: McpLibraryTools = mock()
    private val article: McpArticleTools = mock()
    private val write: McpWriteTools = mock()
    private val interests: McpInterestTools = mock()
    private val dispatcher = McpToolDispatcher(library, article, write, interests)

    private fun client(writes: Boolean = false): McpPrincipal = McpPrincipal(
        userId = TOOLS_UID,
        clientId = "desk",
        writesEnabled = writes,
    )

    @Test
    fun readToolsRouteWithoutConsent() {
        dispatcher.execute(client(), "list_feeds", emptyMap())
        dispatcher.execute(client(), "search_articles", mapOf("q" to "ai"))
        dispatcher.execute(client(), "open_summary", mapOf("articleId" to "a1"))

        verify(library).feeds(TOOLS_UID)
        verify(article).search(TOOLS_UID, "ai")
        verify(article).summary(TOOLS_UID, "a1")
    }

    @Test
    fun remainingReadToolsRoute() {
        dispatcher.execute(client(), "list_folders", emptyMap())
        dispatcher.execute(client(), "fetch_body", mapOf("articleId" to "a1"))
        dispatcher.execute(client(), "quote_highlight", mapOf("articleId" to "a1"))

        verify(library).folders(TOOLS_UID)
        verify(article).body(TOOLS_UID, "a1")
        verify(article).quote(TOOLS_UID, "a1")
    }

    @Test
    fun starAndSaveRouteWithConsent() {
        dispatcher.execute(client(true), "star_article", mapOf("articleId" to "a1", "confirm" to "star_article"))
        dispatcher.execute(client(true), "save_for_later", mapOf("articleId" to "a1", "confirm" to "save_for_later"))

        verify(write).star(TOOLS_UID, "a1")
        verify(write).save(TOOLS_UID, "a1")
    }

    @Test
    fun missingArgumentIsRejected() {
        assertThrows<ApiException> { dispatcher.execute(client(), "open_summary", emptyMap()) }
    }

    @Test
    fun writeToolIsRejectedWithoutConsent() {
        val err = assertThrows<ApiException> {
            dispatcher.execute(client(), "star_article", mapOf("articleId" to "a1", "confirm" to "star_article"))
        }
        assertEquals(HttpStatus.FORBIDDEN, err.status)
    }

    @Test
    fun writeToolNeedsExplicitConfirm() {
        val err = assertThrows<ApiException> {
            dispatcher.execute(client(true), "star_article", mapOf("articleId" to "a1"))
        }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }

    @Test
    fun confirmedWriteToolExecutes() {
        whenever(write.board(any(), any(), any())).thenReturn(mapOf("ok" to true, "status" to "pinned"))
        val result = dispatcher.execute(
            client(true),
            "add_to_board",
            mapOf("articleId" to "a1", "boardId" to "b1", "confirm" to "add_to_board"),
        )

        verify(write).board(TOOLS_UID, "a1", "b1")
        assertEquals("pinned", (result as Map<*, *>)["status"])
    }

    @Test
    fun writeToolForUnknownNameIsRejected() {
        assertThrows<ApiException> { dispatcher.execute(client(true), "drop_tables", emptyMap()) }
    }
}
