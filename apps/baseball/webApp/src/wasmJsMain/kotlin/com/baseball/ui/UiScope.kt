@file:Suppress("WildcardImport", "MagicNumber", "MaxLineLength", "TooManyFunctions", "LongMethod", "CognitiveComplexMethod", "CyclomaticComplexMethod", "NestedBlockDepth", "LongParameterList", "ComplexCondition", "TooGenericExceptionCaught", "SwallowedException", "ObjectPropertyNaming", "ReturnCount", "DestructuringDeclarationWithTooManyEntries", "UnusedPrivateMember", "UnusedPrivateProperty", "UnusedParameter")

package com.baseball.ui

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

val uiScope = CoroutineScope(Dispatchers.Main)

internal fun launch(block: suspend () -> Unit) {
    uiScope.launch {
        block()
    }
}
