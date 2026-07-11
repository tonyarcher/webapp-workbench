package com.baseball.ui.components

import com.baseball.Constants
import com.baseball.models.*
import com.baseball.ui.appendElement
import org.w3c.dom.*

// LED Scoreboard and Diamond Bases visualizer component
fun renderScorerLedScoreboard(parent: HTMLElement, game: Game) {
    val sbHeader = parent.appendElement(Constants.Html.DIV, "scoreboard-header")
    
    val inningSymbol = if (game.gameState.half == HalfInning.TOP) "▲" else "▼"
    sbHeader.appendElement(Constants.Html.SPAN, "inning-display") {
        textContent = "$inningSymbol Inning ${game.gameState.inning}"
    }
    sbHeader.appendElement(Constants.Html.SPAN, "outs-indicator") {
        val outsStr = when (game.gameState.outs) {
            0 -> "No Outs"
            1 -> "1 Out"
            2 -> "2 Outs"
            else -> "3 Outs"
        }
        textContent = outsStr
    }

    // Team Scores Row
    val awayRow = parent.appendElement(Constants.Html.DIV, "scoreboard-row")
    awayRow.appendElement(Constants.Html.SPAN, "team-led-name") { textContent = game.awayTeam.abbreviation }
    awayRow.appendElement(Constants.Html.SPAN, "team-led-score") { textContent = game.awayScore.toString() }

    val homeRow = parent.appendElement(Constants.Html.DIV, "scoreboard-row")
    homeRow.appendElement(Constants.Html.SPAN, "team-led-name") { textContent = game.homeTeam.abbreviation }
    homeRow.appendElement(Constants.Html.SPAN, "team-led-score") { textContent = game.homeScore.toString() }

    val countRow = parent.appendElement(Constants.Html.DIV, "scoreboard-row") {
        style.setProperty(Constants.Css.MARGIN_TOP, "1rem")
    }
    countRow.appendElement(Constants.Html.SPAN, "count-display") {
        textContent = "Count: ${game.gameState.balls} - ${game.gameState.strikes}"
    }
    countRow.appendElement(Constants.Html.SPAN) {
        textContent = "R-H-E: ${game.awayScore}-${game.awayHits}-${game.awayErrors} vs ${game.homeScore}-${game.homeHits}-${game.homeErrors}"
        style.setProperty(Constants.Css.COLOR, "var(--text-secondary)")
        style.setProperty(Constants.Css.FONT_SIZE, "0.9rem")
    }

    // Diamond Bases Visualization
    val diamondContainer = parent.appendElement(Constants.Html.DIV, "diamond-container")
    val baseDiamond = diamondContainer.appendElement(Constants.Html.DIV, "base-diamond")
    
    baseDiamond.appendElement(Constants.Html.DIV, "base base-first" + if (game.gameState.runnerFirstId != null) " occupied" else "") {
        appendElement(Constants.Html.DIV, "base-label") {
            textContent = "1st"
            style.setProperty(Constants.Css.TOP, "-15px")
            style.setProperty(Constants.Css.RIGHT, "-15px")
        }
    }
    baseDiamond.appendElement(Constants.Html.DIV, "base base-second" + if (game.gameState.runnerSecondId != null) " occupied" else "") {
        appendElement(Constants.Html.DIV, "base-label") {
            textContent = "2nd"
            style.setProperty(Constants.Css.TOP, "-15px")
            style.setProperty(Constants.Css.LEFT, "-15px")
        }
    }
    baseDiamond.appendElement(Constants.Html.DIV, "base base-third" + if (game.gameState.runnerThirdId != null) " occupied" else "") {
        appendElement(Constants.Html.DIV, "base-label") {
            textContent = "3rd"
            style.setProperty(Constants.Css.BOTTOM, "-15px")
            style.setProperty(Constants.Css.LEFT, "-15px")
        }
    }
    baseDiamond.appendElement(Constants.Html.DIV, "base base-home")
    
    // Runner details on LED
    val runnersDetails = parent.appendElement(Constants.Html.DIV) {
        style.setProperty(Constants.Css.FONT_SIZE, "0.85rem")
        style.setProperty(Constants.Css.MARGIN_TOP, "1rem")
        style.setProperty(Constants.Css.COLOR, "var(--text-secondary)")
        style.setProperty("border-top", "1px solid #1a2f24")
        style.setProperty(Constants.Css.PADDING_TOP, "0.5rem")
    }
    if (game.gameState.runnerFirstName != null) runnersDetails.appendElement(Constants.Html.DIV) { textContent = "1B: ${game.gameState.runnerFirstName}" }
    if (game.gameState.runnerSecondName != null) runnersDetails.appendElement(Constants.Html.DIV) { textContent = "2B: ${game.gameState.runnerSecondName}" }
    if (game.gameState.runnerThirdName != null) runnersDetails.appendElement(Constants.Html.DIV) { textContent = "3B: ${game.gameState.runnerThirdName}" }
}
