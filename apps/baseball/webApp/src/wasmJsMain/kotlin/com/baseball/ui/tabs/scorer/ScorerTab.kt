package com.baseball.ui.tabs.scorer

import com.baseball.game.localAwayRoster
import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.game.localGame
import com.baseball.game.localHomeRoster
import com.baseball.models.Game
import com.baseball.models.BoxScore
import com.baseball.ui.gametracking.scorebook.renderScorecardSheet
import com.baseball.ui.gametracking.scoring.GameScoringController
import com.baseball.ui.state.isSingleGameMode
import kotlinx.browser.document
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

internal fun renderScorerTab(container: HTMLElement) {
    container.innerHTML = ""

    val game = localGame
    val boxScore = localBoxScore
    if (game == null || boxScore == null) {
        container.innerHTML = "<p>No active game scoring session.</p>"
        return
    }

    container.innerHTML = """
        <h1>Live Scoring: ${game.awayTeam.name} @ ${game.homeTeam.name}</h1>
        <div class="action-grid-2col margin-bottom-lg" id="scorer-top-grid">
            <div id="scoreboard-mount"></div>
            <div id="scoring-controls-mount"></div>
        </div>
        <div class="margin-top-lg" id="scorebook-mount"></div>
    """.trimIndent()

    mountScoreboard(game, boxScore)
    mountScoringControls(game)
    mountScorecardSheet(game, boxScore)
}

private fun mountScoreboard(game: Game, boxScore: BoxScore) {
    val mount = document.getElementById("scoreboard-mount") as? HTMLElement ?: return
    val maxInning = localEvents.maxOfOrNull { it.inning }?.coerceAtLeast(9) ?: 9
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
    game.gameState.runnerFirstId?.let {
        scoreboard.setAttribute("runner-first", "true")
        scoreboard.setAttribute("runner-first-name", game.gameState.runnerFirstName ?: "Runner on 1B")
    }
    game.gameState.runnerSecondId?.let {
        scoreboard.setAttribute("runner-second", "true")
        scoreboard.setAttribute("runner-second-name", game.gameState.runnerSecondName ?: "Runner on 2B")
    }
    game.gameState.runnerThirdId?.let {
        scoreboard.setAttribute("runner-third", "true")
        scoreboard.setAttribute("runner-third-name", game.gameState.runnerThirdName ?: "Runner on 3B")
    }
    mount.appendChild(scoreboard)
}

private fun mountScoringControls(game: Game) {
    val mount = document.getElementById("scoring-controls-mount") as? HTMLElement ?: return
    val controller = GameScoringController(
        mount,
        game,
        if (isSingleGameMode) localHomeRoster else emptyList(),
        if (isSingleGameMode) localAwayRoster else emptyList(),
    )
    controller.render()
}

private fun mountScorecardSheet(game: Game, boxScore: BoxScore) {
    val mount = document.getElementById("scorebook-mount") as? HTMLElement ?: return
    renderScorecardSheet(mount, game, boxScore, localEvents, game.gameState.half)
}
