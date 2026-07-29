package com.baseball.ui.gametracking.scoring

import com.baseball.models.Game
import com.baseball.models.HalfInning
import com.baseball.ui.css
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.CssBuilder
import kotlinx.css.borderTop
import kotlinx.css.color
import kotlinx.css.fontSize
import kotlinx.css.marginTop
import kotlinx.css.paddingTop
import kotlinx.css.px
import kotlinx.css.rem
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
        div {
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
    parent.div(classes = "scoreboard-row") {
        css {
            marginTop = 1.rem
        }
        span(classes = "count-display") {
            +"Count: ${game.gameState.balls} - ${game.gameState.strikes}"
        }
        span {
            +(
                    "R-H-E: ${game.awayScore}-${game.awayHits}-${game.awayErrors} " +
                            "vs ${game.homeScore}-${game.homeHits}-${game.homeErrors}"
                    )
            css {
                color = Color("var(--text-secondary)")
                fontSize = 0.9.rem
            }
        }
    }
}

private fun renderDiamondBases(
    parent: DIV,
    game: Game,
) {
    parent.div(classes = "diamond-container") {
        div(classes = "base-diamond") {
            renderBase("base-first", "1st", game.gameState.runnerFirstId != null) {
                put("top", "-15px")
                put("right", "-15px")
            }
            renderBase("base-second", "2nd", game.gameState.runnerSecondId != null) {
                put("top", "-15px")
                put("left", "-15px")
            }
            renderBase("base-third", "3rd", game.gameState.runnerThirdId != null) {
                put("bottom", "-15px")
                put("left", "-15px")
            }
            div(classes = "base base-home")
        }
    }
}

private fun DIV.renderBase(
    baseClass: String,
    label: String,
    isOccupied: Boolean,
    labelCss: CssBuilder.() -> Unit,
) {
    div(classes = "base $baseClass" + if (isOccupied) " occupied" else "") {
        div(classes = "base-label") {
            +label
            css(labelCss)
        }
    }
}

private fun renderRunnerDetails(
    parent: DIV,
    game: Game,
) {
    parent.div {
        css {
            fontSize = 0.85.rem
            marginTop = 1.rem
            color = Color("var(--text-secondary)")
            borderTop = Border(1.px, BorderStyle.solid, Color("#1a2f24"))
            paddingTop = 0.5.rem
        }
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
