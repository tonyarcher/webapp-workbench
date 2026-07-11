package com.baseball.ui.components

import com.baseball.UiConstants

import com.baseball.models.*
import com.baseball.ui.appendElement
import org.w3c.dom.*

// LED Scoreboard and Diamond Bases visualizer component
fun renderScorerLedScoreboard(parent: HTMLElement, game: Game) {
    val sbHeader = parent.appendElement(UiConstants.Html.DIV, "scoreboard-header")
    
    val inningSymbol = if (game.gameState.half == HalfInning.TOP) "▲" else "▼"
    sbHeader.appendElement(UiConstants.Html.SPAN, "inning-display") {
        textContent = "$inningSymbol Inning ${game.gameState.inning}"
    }
    sbHeader.appendElement(UiConstants.Html.SPAN, "outs-indicator") {
        val outsStr = when (game.gameState.outs) {
            0 -> "No Outs"
            1 -> "1 Out"
            2 -> "2 Outs"
            else -> "3 Outs"
        }
        textContent = outsStr
    }

    // Team Scores Row
    val awayRow = parent.appendElement(UiConstants.Html.DIV, "scoreboard-row")
    awayRow.appendElement(UiConstants.Html.SPAN, "team-led-name") { textContent = game.awayTeam.abbreviation }
    awayRow.appendElement(UiConstants.Html.SPAN, "team-led-score") { textContent = game.awayScore.toString() }

    val homeRow = parent.appendElement(UiConstants.Html.DIV, "scoreboard-row")
    homeRow.appendElement(UiConstants.Html.SPAN, "team-led-name") { textContent = game.homeTeam.abbreviation }
    homeRow.appendElement(UiConstants.Html.SPAN, "team-led-score") { textContent = game.homeScore.toString() }

    val countRow = parent.appendElement(UiConstants.Html.DIV, "scoreboard-row") {
        style.setProperty(UiConstants.Css.MARGIN_TOP, "1rem")
    }
    countRow.appendElement(UiConstants.Html.SPAN, "count-display") {
        textContent = "Count: ${game.gameState.balls} - ${game.gameState.strikes}"
    }
    countRow.appendElement(UiConstants.Html.SPAN) {
        textContent = "R-H-E: ${game.awayScore}-${game.awayHits}-${game.awayErrors} vs ${game.homeScore}-${game.homeHits}-${game.homeErrors}"
        style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.9rem")
    }

    // Diamond Bases Visualization
    val diamondContainer = parent.appendElement(UiConstants.Html.DIV, "diamond-container")
    val baseDiamond = diamondContainer.appendElement(UiConstants.Html.DIV, "base-diamond")
    
    baseDiamond.appendElement(UiConstants.Html.DIV, "base base-first" + if (game.gameState.runnerFirstId != null) " occupied" else "") {
        appendElement(UiConstants.Html.DIV, "base-label") {
            textContent = "1st"
            style.setProperty(UiConstants.Css.TOP, "-15px")
            style.setProperty(UiConstants.Css.RIGHT, "-15px")
        }
    }
    baseDiamond.appendElement(UiConstants.Html.DIV, "base base-second" + if (game.gameState.runnerSecondId != null) " occupied" else "") {
        appendElement(UiConstants.Html.DIV, "base-label") {
            textContent = "2nd"
            style.setProperty(UiConstants.Css.TOP, "-15px")
            style.setProperty(UiConstants.Css.LEFT, "-15px")
        }
    }
    baseDiamond.appendElement(UiConstants.Html.DIV, "base base-third" + if (game.gameState.runnerThirdId != null) " occupied" else "") {
        appendElement(UiConstants.Html.DIV, "base-label") {
            textContent = "3rd"
            style.setProperty(UiConstants.Css.BOTTOM, "-15px")
            style.setProperty(UiConstants.Css.LEFT, "-15px")
        }
    }
    baseDiamond.appendElement(UiConstants.Html.DIV, "base base-home")
    
    // Runner details on LED
    val runnersDetails = parent.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
        style.setProperty(UiConstants.Css.MARGIN_TOP, "1rem")
        style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
        style.setProperty("border-top", "1px solid #1a2f24")
        style.setProperty(UiConstants.Css.PADDING_TOP, "0.5rem")
    }
    if (game.gameState.runnerFirstName != null) runnersDetails.appendElement(UiConstants.Html.DIV) { textContent = "1B: ${game.gameState.runnerFirstName}" }
    if (game.gameState.runnerSecondName != null) runnersDetails.appendElement(UiConstants.Html.DIV) { textContent = "2B: ${game.gameState.runnerSecondName}" }
    if (game.gameState.runnerThirdName != null) runnersDetails.appendElement(UiConstants.Html.DIV) { textContent = "3B: ${game.gameState.runnerThirdName}" }
}
