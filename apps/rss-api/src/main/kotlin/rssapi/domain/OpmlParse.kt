package rssapi.domain

import org.w3c.dom.Element

fun parseOpml(xml: String): List<OpmlNode> {
    val doc = parseXml(xml)
    val body = doc.documentElement.descendants("body").firstOrNull() ?: doc.documentElement
    return body.childOutlines().map { parseOpmlNode(it) }
}

fun parseOpmlNode(outline: Element): OpmlNode {
    val xmlUrl = outline.getAttribute("xmlUrl")
    val kids = outline.childOutlines()
    val title = outline.getAttribute("title").ifEmpty { outline.getAttribute("text") }.ifEmpty { "Untitled" }
    if (xmlUrl.isNotEmpty() || kids.isEmpty()) {
        return OpmlSource(
            title = title,
            xmlUrl = xmlUrl,
            htmlUrl = outline.getAttribute("htmlUrl").ifEmpty { null },
        )
    }
    return OpmlFolder(title = title, children = kids.map { parseOpmlNode(it) })
}

private fun Element.childOutlines(): List<Element> {
    val out = mutableListOf<Element>()
    val kids = childNodes
    for (i in 0 until kids.length) {
        val n = kids.item(i)
        if (n is Element && n.local() == "outline") out.add(n)
    }
    return out
}

fun escXml(s: String): String =
    s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
