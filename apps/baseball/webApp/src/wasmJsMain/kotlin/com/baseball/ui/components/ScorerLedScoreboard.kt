package com.baseball.ui.components

import com.baseball.models.*
import com.baseball.ui.appendElement
import org.w3c.dom.*

// LED Scoreboard and Diamond Bases visualizer component
fun renderScorerLedScoreboard(parent: HTMLElement, game: Game) {
    val sbHeader = parent.appendElement("div", "scoreboard-header")
    
    val inningSymbol = if (game.gameState.half == HalfInning.TOP) "▲" else "▼"
    sbHeader.appendElement("span", "inning-display") {
        textContent = "$inningSymbol Inning ${game.gameState.inning}"
    }
    sbHeader.appendElement("span", "outs-indicator") {
        val outsStr = when (game.gameState.outs) {
            0 -> "No Outs"
            1 -> "1 Out"
            2 -> "2 Outs"
            else -> "3 Outs"
        }
        textContent = outsStr
    }

    // Team Scores Row
    val awayRow = parent.appendElement("div", "scoreboard-row")
    awayRow.appendElement("span", "team-led-name") { textContent = game.awayTeam.abbreviation }
    awayRow.appendElement("span", "team-led-score") { textContent = game.awayScore.toString() }

    val homeRow = parent.appendElement("div", "scoreboard-row")
    homeRow.appendElement("span", "team-led-name") { textContent = game.homeTeam.abbreviation }
    homeRow.appendElement("span", "team-led-score") { textContent = game.homeScore.toString() }

    val countRow = parent.appendElement("div", "scoreboard-row") {
        style.setProperty("margin-top", "1rem")
    }
    countRow.appendElement("span", "count-display") {
        textContent = "Count: ${game.gameState.balls} - ${game.gameState.strikes}"
    }
    countRow.appendElement("span") {
        textContent = "R-H-E: ${game.awayScore}-${game.awayHits}-${game.awayErrors} vs ${game.homeScore}-${game.homeHits}-${game.homeErrors}"
        style.setProperty("color", "var(--text-secondary)")
        style.setProperty("font-size", "0.9rem")
    }

    // Diamond Bases Visualization
    val diamondContainer = parent.appendElement("div", "diamond-container")
    val baseDiamond = diamondContainer.appendElement("div", "base-diamond")
    
    baseDiamond.appendElement("div", "base base-first" + if (game.gameState.runnerFirstId != null) " occupied" else "") {
        appendElement("div", "base-label") {
            textContent = "1st"
            style.setProperty("top", "-15px")
            style.setProperty("right", "-15px")
        }
    }
    baseDiamond.appendElement("div", "base base-second" + if (game.gameState.runnerSecondId != null) " occupied" else "") {
        appendElement("div", "base-label") {
            textContent = "2nd"
            style.setProperty("top", "-15px")
            style.setProperty("left", "-15px")
        }
    }
    baseDiamond.appendElement("div", "base base-third" + if (game.gameState.runnerThirdId != null) " occupied" else "") {
        appendElement("div", "base-label") {
            textContent = "3rd"
            style.setProperty("bottom", "-15px")
            style.setProperty("left", "-15px")
        }
    }
    baseDiamond.appendElement("div", "base base-home")
    
    // Runner details on LED
    val runnersDetails = parent.appendElement("div") {
        style.setProperty("font-size", "0.85rem")
        style.setProperty("margin-top", "1rem")
        style.setProperty("color", "var(--text-secondary)")
        style.setProperty("border-top", "1px solid #1a2f24")
        style.setProperty("padding-top", "0.5rem")
    }
    if (game.gameState.runnerFirstName != null) runnersDetails.appendElement("div") { textContent = "1B: ${game.gameState.runnerFirstName}" }
    if (game.gameState.runnerSecondName != null) runnersDetails.appendElement("div") { textContent = "2B: ${game.gameState.runnerSecondName}" }
    if (game.gameState.runnerThirdName != null) runnersDetails.appendElement("div") { textContent = "3B: ${game.gameState.runnerThirdName}" }
}
