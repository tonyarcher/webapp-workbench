package com.baseball.ui.components

import com.baseball.models.*
import com.baseball.ui.*
import org.w3c.dom.*
import kotlinx.html.*
import kotlinx.html.js.*

fun renderScorerLedScoreboard(parent: HTMLElement, game: Game) {
    parent.innerHTML = ""

    parent.div {
        renderScoreboardHeader(this, game)
        renderTeamScores(this, game)
        renderCountAndSummary(this, game)
        renderDiamondBases(this, game)
        renderRunnerDetails(this, game)
    }
}

private fun renderScoreboardHeader(parent: DIV, game: Game) {
    val inningSymbol = if (game.gameState.half == HalfInning.TOP) "▲" else "▼"
    parent.div(classes = "scoreboard-header") {
        span(classes = "inning-display") {
            +"$inningSymbol Inning ${game.gameState.inning}"
        }
        span(classes = "outs-indicator") {
            val outsStr = when (game.gameState.outs) {
                0 -> "No Outs"
                1 -> "1 Out"
                2 -> "2 Outs"
                else -> "3 Outs"
            }
            +outsStr
        }
    }
}

private fun renderTeamScores(parent: DIV, game: Game) {
    parent.div(classes = "scoreboard-row") {
        span(classes = "team-led-name") { +game.awayTeam.abbreviation }
        span(classes = "team-led-score") { +game.awayScore.toString() }
    }
    parent.div(classes = "scoreboard-row") {
        span(classes = "team-led-name") { +game.homeTeam.abbreviation }
        span(classes = "team-led-score") { +game.homeScore.toString() }
    }
}

private fun renderCountAndSummary(parent: DIV, game: Game) {
    parent.div(classes = "scoreboard-row") {
        style = "margin-top: 1rem;"
        span(classes = "count-display") {
            +"Count: ${game.gameState.balls} - ${game.gameState.strikes}"
        }
        span {
            +"R-H-E: ${game.awayScore}-${game.awayHits}-${game.awayErrors} vs ${game.homeScore}-${game.homeHits}-${game.homeErrors}"
            style = "color: var(--text-secondary); font-size: 0.9rem;"
        }
    }
}

private fun renderDiamondBases(parent: DIV, game: Game) {
    parent.div(classes = "diamond-container") {
        div(classes = "base-diamond") {
            div(classes = "base base-first" + if (game.gameState.runnerFirstId != null) " occupied" else "") {
                div(classes = "base-label") {
                    +"1st"
                    style = "top: -15px; right: -15px;"
                }
            }
            div(classes = "base base-second" + if (game.gameState.runnerSecondId != null) " occupied" else "") {
                div(classes = "base-label") {
                    +"2nd"
                    style = "top: -15px; left: -15px;"
                }
            }
            div(classes = "base base-third" + if (game.gameState.runnerThirdId != null) " occupied" else "") {
                div(classes = "base-label") {
                    +"3rd"
                    style = "bottom: -15px; left: -15px;"
                }
            }
            div(classes = "base base-home")
        }
    }
}

private fun renderRunnerDetails(parent: DIV, game: Game) {
    parent.div {
        style = "font-size: 0.85rem; margin-top: 1rem; color: var(--text-secondary); border-top: 1px solid #1a2f24; padding-top: 0.5rem;"
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
