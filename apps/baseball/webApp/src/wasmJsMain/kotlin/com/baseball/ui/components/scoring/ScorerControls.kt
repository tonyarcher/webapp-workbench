@file:Suppress("WildcardImport", "MagicNumber", "MaxLineLength", "TooManyFunctions", "LongMethod", "CognitiveComplexMethod", "CyclomaticComplexMethod", "NestedBlockDepth", "LongParameterList", "ComplexCondition", "TooGenericExceptionCaught", "SwallowedException", "ObjectPropertyNaming", "ReturnCount", "DestructuringDeclarationWithTooManyEntries", "UnusedPrivateMember", "UnusedPrivateProperty", "UnusedParameter")

package com.baseball.ui.components.scoring

import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.Player
import org.w3c.dom.HTMLElement

fun renderGameScoringControls(
    rightCol: HTMLElement,
    game: Game,
    homeRoster: List<Player>,
    awayRoster: List<Player>,
    boxScore: BoxScore,
) {
    val controller = GameScoringController(rightCol, game, homeRoster, awayRoster)
    controller.render()
}
