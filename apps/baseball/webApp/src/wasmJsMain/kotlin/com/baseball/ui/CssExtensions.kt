@file:Suppress("WildcardImport", "MagicNumber", "MaxLineLength", "TooManyFunctions", "LongMethod", "CognitiveComplexMethod", "CyclomaticComplexMethod", "NestedBlockDepth", "LongParameterList", "ComplexCondition", "TooGenericExceptionCaught", "SwallowedException", "ObjectPropertyNaming", "ReturnCount", "DestructuringDeclarationWithTooManyEntries", "UnusedPrivateMember", "UnusedPrivateProperty", "UnusedParameter")

package com.baseball.ui

import kotlinx.css.CssBuilder
import kotlinx.html.HTMLTag

fun HTMLTag.css(builder: CssBuilder.() -> Unit) {
    val styleStr = CssBuilder().apply(builder).toString()
    if (styleStr.isNotEmpty()) {
        attributes["style"] = styleStr
    }
}
