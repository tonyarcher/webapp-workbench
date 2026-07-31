package com.baseball.ui.gametracking.scoring

import com.baseball.models.Game
import com.baseball.models.Player
import kotlinx.browser.document
import org.w3c.dom.HTMLElement

internal fun renderPlateMatchupCard(
    parent: HTMLElement,
    game: Game,
    homeRoster: List<Player>,
    awayRoster: List<Player>,
) {
    val allPlayers = awayRoster + homeRoster
    val currBatter = allPlayers.find { it.id == game.gameState.currentBatterId }
    val currPitcher = allPlayers.find { it.id == game.gameState.currentPitcherId }

    val batterName = game.gameState.currentBatterName ?: currBatter?.name ?: "Current Batter"
    val batterStats = currBatter?.let {
        "${it.position} | #${it.jerseyNumber} | Bat: ${it.battingHand}"
    } ?: "AVG .333 | 2 HR"

    val pitcherName = game.gameState.currentPitcherName ?: currPitcher?.name ?: "Current Pitcher"
    val pitcherStats = currPitcher?.let {
        "${it.position} | #${it.jerseyNumber} | Throw: ${it.throwingHand}"
    } ?: "ERA 2.50 | 15 K"

    parent.innerHTML = ""
    val card = document.createElement("baseball-matchup-card")
    card.setAttribute("batter-name", batterName)
    card.setAttribute("batter-stats", batterStats)
    card.setAttribute("pitcher-name", pitcherName)
    card.setAttribute("pitcher-stats", pitcherStats)
    parent.appendChild(card)
}
