package com.baseball.ui.gametracking.scoring

import com.baseball.models.Game
import com.baseball.models.HalfInning
import kotlinx.browser.document
import org.w3c.dom.HTMLElement

fun renderScorerLedScoreboard(
    parent: HTMLElement,
    game: Game,
) {
    parent.innerHTML = ""
    val scoreboard = document.createElement("baseball-scoreboard")

    scoreboard.setAttribute("away-name", game.awayTeam.abbreviation)
    scoreboard.setAttribute("home-name", game.homeTeam.abbreviation)
    scoreboard.setAttribute("away-score", game.awayScore.toString())
    scoreboard.setAttribute("home-score", game.homeScore.toString())
    scoreboard.setAttribute("away-hits", game.awayHits.toString())
    scoreboard.setAttribute("home-hits", game.homeHits.toString())
    scoreboard.setAttribute("away-errors", game.awayErrors.toString())
    scoreboard.setAttribute("home-errors", game.homeErrors.toString())

    scoreboard.setAttribute("inning", game.gameState.inning.toString())
    scoreboard.setAttribute("half", if (game.gameState.half == HalfInning.TOP) "TOP" else "BOTTOM")
    scoreboard.setAttribute("balls", game.gameState.balls.toString())
    scoreboard.setAttribute("strikes", game.gameState.strikes.toString())
    scoreboard.setAttribute("outs", game.gameState.outs.toString())

    if (game.gameState.runnerFirstId != null) scoreboard.setAttribute("runner-first", "true")
    if (game.gameState.runnerSecondId != null) scoreboard.setAttribute("runner-second", "true")
    if (game.gameState.runnerThirdId != null) scoreboard.setAttribute("runner-third", "true")

    game.gameState.runnerFirstName?.let { scoreboard.setAttribute("runner-first-name", it) }
    game.gameState.runnerSecondName?.let { scoreboard.setAttribute("runner-second-name", it) }
    game.gameState.runnerThirdName?.let { scoreboard.setAttribute("runner-third-name", it) }

    parent.appendChild(scoreboard)
}
