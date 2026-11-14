package rssapi.domain

import org.jsoup.nodes.Document

private const val MIN_TEXT_CHARS = 280
private const val HEX_RADIX = 16
private const val UNICODE_HEX_LEN = 4
private const val UNICODE_SKIP = 4

internal fun jsonLdArticleBody(doc: Document): String? {
    for (script in doc.select("script[type=application/ld+json]")) {
        val html = articleBodyHtml(script.data())
        if (html != null) return html
    }
    return null
}

private fun articleBodyHtml(data: String): String? {
    val trimmed = data.trim()
    if (trimmed.isEmpty() || !trimmed.contains("articleBody", ignoreCase = true)) return null
    val body = extractJsonString(trimmed, "articleBody") ?: return null
    val text = body.trim()
    if (text.length < MIN_TEXT_CHARS) return null
    val html = paragraphsHtml(text)
    return if (html.length >= MIN_TEXT_CHARS) html else null
}

private fun paragraphsHtml(text: String): String {
    val escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    val parts = escaped.split(Regex("\\n\\s*\\n|\\r\\n\\s*\\r\\n")).map { it.trim() }.filter { it.isNotEmpty() }
    if (parts.size <= 1) return "<p>${escaped.replace(Regex("\\n"), "<br>")}</p>"
    return parts.joinToString("") { "<p>${it.replace(Regex("\\n"), "<br>")}</p>" }
}

private fun extractJsonString(json: String, key: String): String? {
    val start = jsonStringStart(json, key) ?: return null
    return scanJsonString(json, start).ifBlank { null }
}

private fun jsonStringStart(json: String, key: String): Int? {
    val idx = json.indexOf("\"$key\"", ignoreCase = true)
    if (idx < 0) return null
    val colon = json.indexOf(':', idx + key.length + 2)
    if (colon < 0) return null
    var i = colon + 1
    while (i < json.length && json[i].isWhitespace()) i++
    if (i >= json.length || json[i] != '"') return null
    return i + 1
}

private fun scanJsonString(json: String, start: Int): String {
    val sb = StringBuilder()
    var i = start
    while (i < json.length) {
        val c = json[i]
        if (c == '"') break
        if (c == '\\' && i + 1 < json.length) {
            i += appendEscape(sb, json, i)
        } else {
            sb.append(c)
            i++
        }
    }
    return sb.toString()
}

private fun appendEscape(sb: StringBuilder, json: String, i: Int): Int {
    val n = json[i + 1]
    if (n == 'u') return appendUnicodeEscape(sb, json, i)
    sb.append(simpleEscape(n))
    return 2
}

private fun appendUnicodeEscape(sb: StringBuilder, json: String, i: Int): Int {
    val end = (i + 2 + UNICODE_HEX_LEN).coerceAtMost(json.length)
    val hex = json.substring((i + 2).coerceAtMost(json.length), end)
    runCatching { sb.append(hex.toInt(HEX_RADIX).toChar()) }
    return 2 + UNICODE_SKIP
}

private fun simpleEscape(n: Char): Char = when (n) {
    '"', '\\', '/' -> n
    'n' -> '\n'
    'r' -> '\r'
    't' -> '\t'
    'b' -> '\b'
    'f' -> '\u000C'
    else -> n
}
