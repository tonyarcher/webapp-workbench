package com.baseball.ui.tabs.scorer

import com.baseball.game.localAwayRoster
import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.game.localGame
import com.baseball.game.localHomeRoster
import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.ui.gametracking.scorebook.renderScorecardSheet
import com.baseball.ui.gametracking.scoring.GameScoringController
import com.baseball.ui.state.isSingleGameMode
import kotlinx.browser.document
import org.w3c.dom.HTMLElement

internal fun renderScorerTab(container: HTMLElement) {
    container.innerHTML = ""

    val game = localGame
    val boxScore = localBoxScore
    if (game == null || boxScore == null) {
        val msg = document.createElement("p")
        msg.textContent = "No active game scoring session."
        container.appendChild(msg)
        return
    }

    val header = document.createElement("div") as HTMLElement
    header.className = "flex-between margin-bottom-md"
    header.innerHTML = "<h1 style='margin: 0;'>Live Scoring: ${game.awayTeam.name} @ ${game.homeTeam.name}</h1>"
    container.appendChild(header)

    renderTopGridSection(container, game, boxScore)

    val bottomSection = document.createElement("div") as HTMLElement
    bottomSection.className = "margin-top-lg"
    container.appendChild(bottomSection)

    renderScorecardSheet(bottomSection, game, boxScore, localEvents, game.gameState.half)
}

private fun renderTopGridSection(container: HTMLElement, game: Game, boxScore: BoxScore) {
    val topGrid = document.createElement("div") as HTMLElement
    topGrid.className = "action-grid-2col margin-bottom-lg"

    val leftCol = document.createElement("div") as HTMLElement
    val rightCol = document.createElement("div") as HTMLElement

    topGrid.appendChild(leftCol)
    topGrid.appendChild(rightCol)
    container.appendChild(topGrid)

    renderScoreboardElement(leftCol, game, boxScore)

    val controller = GameScoringController(
        rightCol,
        game,
        if (isSingleGameMode) localHomeRoster else emptyList(),
        if (isSingleGameMode) localAwayRoster else emptyList()
    )
    controller.render()
}

private fun renderScoreboardElement(
    parent: HTMLElement,
    game: Game,
    boxScore: BoxScore,
) {
    val scoreboard = document.createElement("baseball-scoreboard")
    scoreboard.setAttribute("away-name", game.awayTeam.name)
    scoreboard.setAttribute("home-name", game.homeTeam.name)
    scoreboard.setAttribute("away-score", game.awayScore.toString())
    scoreboard.setAttribute("home-score", game.homeScore.toString())
    scoreboard.setAttribute("away-hits", boxScore.lineScore.awayHits.toString())
    scoreboard.setAttribute("home-hits", boxScore.lineScore.homeHits.toString())
    scoreboard.setAttribute("away-errors", boxScore.lineScore.awayErrors.toString())
    scoreboard.setAttribute("home-errors", boxScore.lineScore.homeErrors.toString())
    scoreboard.setAttribute("inning", game.gameState.inning.toString())
    scoreboard.setAttribute("half", game.gameState.half.name)
    scoreboard.setAttribute("balls", game.gameState.balls.toString())
    scoreboard.setAttribute("strikes", game.gameState.strikes.toString())
    scoreboard.setAttribute("outs", game.gameState.outs.toString())

    if (game.gameState.runnerFirstId != null) {
        scoreboard.setAttribute("runner-first", "true")
        scoreboard.setAttribute("runner-first-name", game.gameState.runnerFirstName ?: "Runner on 1B")
    }
    if (game.gameState.runnerSecondId != null) {
        scoreboard.setAttribute("runner-second", "true")
        scoreboard.setAttribute("runner-second-name", game.gameState.runnerSecondName ?: "Runner on 2B")
    }
    if (game.gameState.runnerThirdId != null) {
        scoreboard.setAttribute("runner-third", "true")
        scoreboard.setAttribute("runner-third-name", game.gameState.runnerThirdName ?: "Runner on 3B")
    }

    parent.appendChild(scoreboard)
}
