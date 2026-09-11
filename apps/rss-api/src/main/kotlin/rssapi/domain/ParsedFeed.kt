package rssapi.domain

data class ParsedItem(
    val guid: String,
    val title: String,
    val published: Long,
    val link: String? = null,
    val author: String? = null,
    val summary: String? = null,
    val content: String? = null,
    val media: String? = null,
    val comments: Int? = null,
)

data class ParsedFeed(
    val title: String,
    val siteUrl: String? = null,
    val items: List<ParsedItem>,
)

sealed class OpmlNode {
    abstract val title: String
}

data class OpmlSource(
    override val title: String,
    val xmlUrl: String,
    val htmlUrl: String? = null,
) : OpmlNode()

data class OpmlFolder(
    override val title: String,
    val children: List<OpmlNode>,
) : OpmlNode()
