package timesupapi.mcp

/** Fixed tool contract. A client can ask for the list but cannot add tools. */
object McpToolRegistry {
    val read: List<McpTool> = listOf(
        tool("list_feeds", "Feeds the signed-in reader subscribes to."),
        tool("list_folders", "Folders and saved searches in the reader's library."),
        tool("search_articles", "Search articles with the reader's query operators.", "q"),
        tool("open_summary", "Title, summary and excerpt for one article. No body.", "articleId"),
        tool("fetch_body", "Stored article body, loaded on demand through the reader's tiering seam.", "articleId"),
        tool("quote_highlight", "Verbatim key lines with article provenance.", "articleId"),
        tool("list_interests", "Interests the reader follows, with weights and origins."),
        tool("list_promotions", "Today's promoted lane with match reasons."),
    )

    val write: List<McpTool> = listOf(
        tool(
            "star_article",
            "Star an article. Requires write consent and an explicit confirm.",
            "articleId",
            "confirm",
        ),
        tool("save_for_later", "Save an article for later. Requires consent and confirm.", "articleId", "confirm"),
        tool(
            "add_to_board",
            "Pin an article to a board. Requires consent and confirm.",
            "articleId",
            "boardId",
            "confirm",
        ),
    )

    fun tools(writesEnabled: Boolean): List<McpTool> = if (writesEnabled) read + write else read

    private fun tool(name: String, description: String, vararg required: String): McpTool {
        val properties = required.associateWith { mapOf<String, Any>("type" to "string") }
        return McpTool(
            name = name,
            description = description,
            inputSchema = mapOf("type" to "object", "properties" to properties, "required" to required.toList()),
        )
    }
}
