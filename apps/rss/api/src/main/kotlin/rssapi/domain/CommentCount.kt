package rssapi.domain

import org.w3c.dom.Element

internal fun parseCommentCount(item: Element): Int? {
    val node = item.firstDesc("comments")
        ?: item.firstDesc("total")
        ?: item.firstDesc("comment_count")
        ?: item.firstDesc("comment-count")
    val candidate = node?.textContent?.trim() ?: return null
    val n = candidate.toDoubleOrNull() ?: return null
    return if (n >= 0) n.toInt() else null
}
