package rssapi.domain

private val FEED_ROOTS = setOf("rss", "feed", "rdf")

fun parseFeedXml(xml: String, fallbackPublished: Long): ParsedFeed {
    // JSON Feed is dispatched by content, not extension: many publishers serve
    // it from URLs with no suffix and with application/feed+json or text/plain.
    if (xml.trimStart().removePrefix("\uFEFF").trimStart().startsWith("{")) {
        return parseFeedJson(xml, fallbackPublished)
    }
    val doc = parseXml(xml)
    val root = doc.documentElement ?: throw IllegalArgumentException("empty XML")
    val base = root.local()
    if (base !in FEED_ROOTS) {
        throw IllegalArgumentException("Not a valid RSS, Atom or JSON feed (HTML or other document)")
    }
    return if (base == "feed") parseAtom(doc, fallbackPublished) else parseRss(doc, fallbackPublished)
}
