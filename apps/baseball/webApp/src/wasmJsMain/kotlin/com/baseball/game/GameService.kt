@file:Suppress("WildcardImport", "MagicNumber", "MaxLineLength", "TooManyFunctions", "LongMethod", "CognitiveComplexMethod", "CyclomaticComplexMethod", "NestedBlockDepth", "LongParameterList", "ComplexCondition", "TooGenericExceptionCaught", "SwallowedException", "ObjectPropertyNaming", "ReturnCount", "DestructuringDeclarationWithTooManyEntries", "UnusedPrivateMember", "UnusedPrivateProperty", "UnusedParameter")

package com.baseball.game

import com.baseball.models.ScoringEventType

interface GameService {
    fun initGame(forceReset: Boolean = false)

    fun recordPlayEvent(
        eventType: ScoringEventType,
        batterId: Long,
        pitcherId: Long,
        descriptionDetail: String? = null,
        isDoublePlay: Boolean = false,
        isError: Boolean = false,
        runnerAdvanceMap: Map<String, Int>? = null,
    )
}
