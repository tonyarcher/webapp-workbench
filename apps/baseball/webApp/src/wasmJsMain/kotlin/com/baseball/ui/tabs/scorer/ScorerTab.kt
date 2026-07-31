package com.baseball.ui.tabs.scorer

import com.baseball.game.localAwayRoster
import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.game.localGame
import com.baseball.game.localHomeRoster
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

    val grid = document.createElement("div")
    grid.className = "action-grid-2col"

    val leftCol = document.createElement("div") as HTMLElement
    val rightCol = document.createElement("div") as HTMLElement

    grid.appendChild(leftCol)
    grid.appendChild(rightCol)
    container.appendChild(grid)

    renderScorecardSheet(leftCol, game, boxScore, localEvents, game.gameState.half)

    val controller = GameScoringController(
        rightCol,
        game,
        if (isSingleGameMode) localHomeRoster else emptyList(),
        if (isSingleGameMode) localAwayRoster else emptyList()
    )
    controller.render()
}
