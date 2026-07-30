package com.baseball.ui.core

import kotlinx.css.CssBuilder
import kotlinx.html.HTMLTag

fun HTMLTag.css(builder: CssBuilder.() -> Unit) {
    val styleStr = CssBuilder().apply(builder).toString()
    if (styleStr.isNotEmpty()) {
        attributes["style"] = styleStr
    }
}
