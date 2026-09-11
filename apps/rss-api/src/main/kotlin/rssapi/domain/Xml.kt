package rssapi.domain

import org.w3c.dom.Document
import org.w3c.dom.Element
import org.w3c.dom.NodeList
import javax.xml.parsers.DocumentBuilderFactory

fun parseXml(xml: String): Document {
    val factory = DocumentBuilderFactory.newInstance()
    factory.isNamespaceAware = true
    factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
    factory.setFeature("http://xml.org/sax/features/external-general-entities", false)
    factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false)
    val builder = factory.newDocumentBuilder()
    return builder.parse(xml.byteInputStream())
}

fun Element.local(): String = localName?.lowercase() ?: tagName.substringAfter(':').lowercase()

fun Element.childText(name: String): String =
    firstDesc(name)?.textContent?.trim().orEmpty()

fun Element.descendants(name: String): List<Element> {
    val out = mutableListOf<Element>()
    collect(this, name.lowercase(), out)
    return out
}

fun Element.firstDesc(name: String): Element? = descendants(name).firstOrNull()

fun NodeList.elements(): List<Element> {
    val out = mutableListOf<Element>()
    for (i in 0 until length) {
        val n = item(i)
        if (n is Element) out.add(n)
    }
    return out
}

private fun collect(el: Element, name: String, out: MutableList<Element>) {
    val kids = el.childNodes
    for (i in 0 until kids.length) {
        val n = kids.item(i)
        if (n is Element) {
            if (n.local() == name) out.add(n)
            collect(n, name, out)
        }
    }
}
