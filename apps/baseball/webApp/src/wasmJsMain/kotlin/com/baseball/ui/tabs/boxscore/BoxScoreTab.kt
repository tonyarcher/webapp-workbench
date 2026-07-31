package com.baseball.ui.tabs.boxscore

import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.game.localGame
import kotlinx.browser.document
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

internal fun renderBoxScoreTab(container: HTMLElement) {
    container.innerHTML = ""

    val game = localGame
    val boxScore = localBoxScore
    if (game == null || boxScore == null) {
        val msg = document.createElement("p")
        msg.textContent = "No active box score available."
        container.appendChild(msg)
        return
    }

    val maxInning = localEvents.maxOfOrNull { it.inning }?.coerceAtLeast(9) ?: 9

    val scoreboard = document.createElement("baseball-scoreboard")
    scoreboard.setAttribute("away-team", game.awayTeam.name)
    scoreboard.setAttribute("home-team", game.homeTeam.name)
    scoreboard.setAttribute("away-runs", game.awayScore.toString())
    scoreboard.setAttribute("home-runs", game.homeScore.toString())
    scoreboard.setAttribute("away-hits", boxScore.lineScore.awayHits.toString())
    scoreboard.setAttribute("home-hits", boxScore.lineScore.homeHits.toString())
    scoreboard.setAttribute("away-errors", boxScore.lineScore.awayErrors.toString())
    scoreboard.setAttribute("home-errors", boxScore.lineScore.homeErrors.toString())
    scoreboard.setAttribute("current-inning", game.gameState.inning.toString())
    scoreboard.setAttribute("half-inning", game.gameState.half.name)
    scoreboard.setAttribute("outs", game.gameState.outs.toString())
    scoreboard.setAttribute("balls", game.gameState.balls.toString())
    scoreboard.setAttribute("strikes", game.gameState.strikes.toString())
    scoreboard.setAttribute("max-inning", maxInning.toString())
    scoreboard.setAttribute("line-score-json", Json.encodeToString(boxScore.lineScore))

    container.appendChild(scoreboard)
}
