package rssapi.domain

private val FEED_ROOTS = setOf("rss", "feed", "rdf")

fun parseFeedXml(xml: String, fallbackPublished: Long): ParsedFeed {
    val doc = parseXml(xml)
    val root = doc.documentElement ?: throw IllegalArgumentException("empty XML")
    val base = root.local()
    if (base !in FEED_ROOTS) {
        throw IllegalArgumentException("Not a valid RSS/Atom feed (HTML or other document)")
    }
    return if (base == "feed") parseAtom(doc, fallbackPublished) else parseRss(doc, fallbackPublished)
}
