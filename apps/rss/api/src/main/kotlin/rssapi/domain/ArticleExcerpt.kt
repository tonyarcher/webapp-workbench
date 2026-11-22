package rssapi.domain

private const val EXCERPT_MAX_CHARS = 4000

/** Plain-text preview for list/search; capped so it stays cheap to select. */
fun excerptOf(html: String?): String {
    val text = stripHtml(html)
    return if (text.length <= EXCERPT_MAX_CHARS) text else text.take(EXCERPT_MAX_CHARS)
}
