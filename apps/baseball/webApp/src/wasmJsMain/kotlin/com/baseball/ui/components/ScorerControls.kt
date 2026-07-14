package com.baseball.ui.components

import com.baseball.models.*
import org.w3c.dom.*

fun renderGameScoringControls(
    rightCol: HTMLElement,
    game: Game,
    homeRoster: List<Player>,
    awayRoster: List<Player>,
    boxScore: BoxScore
) {
    val controller = GameScoringController(rightCol, game, homeRoster, awayRoster, boxScore)
    controller.render()
}
