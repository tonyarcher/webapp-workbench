package com.baseball.ui.gametracking.scoring

import com.baseball.models.Game
import com.baseball.models.Player
import kotlinx.browser.document
import kotlinx.html.DIV
import kotlinx.html.div
import kotlinx.html.id
import org.w3c.dom.HTMLElement

internal fun renderPlateMatchupCard(parent: DIV, game: Game, homeRoster: List<Player>, awayRoster: List<Player>) {
    val currBatter = (awayRoster + homeRoster).find { it.id == game.gameState.currentBatterId }
    val currPitcher = (awayRoster + homeRoster).find { it.id == game.gameState.currentPitcherId }

    val batterName = game.gameState.currentBatterName ?: "None"
    val batterStats = currBatter?.let { "${it.position} | #${it.jerseyNumber} | Bat: ${it.battingHand}" } ?: ""

    val pitcherName = game.gameState.currentPitcherName ?: "None"
    val pitcherStats = currPitcher?.let { "${it.position} | #${it.jerseyNumber} | Throw: ${it.throwingHand}" } ?: ""

    parent.div {
        id = "matchup-card-mount-point"
    }

    val mountPoint = document.getElementById("matchup-card-mount-point") as? HTMLElement
    if (mountPoint != null) {
        mountPoint.innerHTML = ""
        val card = document.createElement("baseball-matchup-card")
        card.setAttribute("batter-name", batterName)
        card.setAttribute("batter-stats", batterStats)
        card.setAttribute("pitcher-name", pitcherName)
        card.setAttribute("pitcher-stats", pitcherStats)
        mountPoint.appendChild(card)
    }
}
