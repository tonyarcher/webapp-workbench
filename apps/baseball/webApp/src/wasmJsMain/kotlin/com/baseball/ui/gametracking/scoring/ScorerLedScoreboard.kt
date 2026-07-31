package com.baseball.ui.gametracking.scoring

import com.baseball.models.Game
import com.baseball.models.HalfInning
import kotlinx.html.DIV
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.span
import org.w3c.dom.HTMLElement

fun renderScorerLedScoreboard(
    parent: HTMLElement,
    game: Game,
) {
    parent.innerHTML = ""

    parent.append {
        div(classes = "scoreboard-led") {
            renderScoreboardHeader(this, game)
            renderTeamScores(this, game)
            renderCountAndSummary(this, game)
            renderDiamondBases(this, game)
            renderRunnerDetails(this, game)
        }
    }
}

private fun renderScoreboardHeader(
    parent: DIV,
    game: Game,
) {
    val inningSymbol = if (game.gameState.half == HalfInning.TOP) "▲" else "▼"
    parent.div(classes = "scoreboard-header") {
        span(classes = "inning-display") {
            +"$inningSymbol Inning ${game.gameState.inning}"
        }
        span(classes = "outs-indicator") {
            val outsStr =
                when (game.gameState.outs) {
                    0 -> "No Outs"
                    1 -> "1 Out"
                    2 -> "2 Outs"
                    else -> "3 Outs"
                }
            +outsStr
        }
    }
}

private fun renderTeamScores(
    parent: DIV,
    game: Game,
) {
    parent.div(classes = "scoreboard-row") {
        span(classes = "team-led-name") { +game.awayTeam.abbreviation }
        span(classes = "team-led-score") { +game.awayScore.toString() }
    }
    parent.div(classes = "scoreboard-row") {
        span(classes = "team-led-name") { +game.homeTeam.abbreviation }
        span(classes = "team-led-score") { +game.homeScore.toString() }
    }
}

private fun renderCountAndSummary(
    parent: DIV,
    game: Game,
) {
    parent.div(classes = "scoreboard-row margin-top-md") {
        span(classes = "count-display") {
            +"Count: ${game.gameState.balls} - ${game.gameState.strikes}"
        }
        span(classes = "text-muted font-small") {
            +(
                    "R-H-E: ${game.awayScore}-${game.awayHits}-${game.awayErrors} " +
                            "vs ${game.homeScore}-${game.homeHits}-${game.homeErrors}"
                    )
        }
    }
}

private fun renderDiamondBases(
    parent: DIV,
    game: Game,
) {
    parent.div(classes = "diamond-container") {
        div(classes = "base-diamond") {
            renderBase("base-first", "1st", game.gameState.runnerFirstId != null)
            renderBase("base-second", "2nd", game.gameState.runnerSecondId != null)
            renderBase("base-third", "3rd", game.gameState.runnerThirdId != null)
            div(classes = "base base-home")
        }
    }
}

private fun DIV.renderBase(
    baseClass: String,
    label: String,
    isOccupied: Boolean,
) {
    div(classes = "base $baseClass" + if (isOccupied) " occupied" else "") {
        div(classes = "base-label") {
            +label
        }
    }
}

private fun renderRunnerDetails(
    parent: DIV,
    game: Game,
) {
    parent.div(classes = "text-muted font-small margin-top-md border-top-dark padding-top-sm") {
        if (game.gameState.runnerFirstName != null) {
            div { +"1B: ${game.gameState.runnerFirstName}" }
        }
        if (game.gameState.runnerSecondName != null) {
            div { +"2B: ${game.gameState.runnerSecondName}" }
        }
        if (game.gameState.runnerThirdName != null) {
            div { +"3B: ${game.gameState.runnerThirdName}" }
        }
    }
}
