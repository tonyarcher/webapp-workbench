package com.baseball.ui.tabs

import com.baseball.api
import com.baseball.game.localAwayRoster
import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.game.localGame
import com.baseball.game.localHomeRoster
import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.PlayerBattingStats
import com.baseball.ui.gametracking.scorebook.renderScorecardSheet
import com.baseball.ui.gametracking.scoring.GameScoringController
import com.baseball.ui.state.isSingleGameMode
import com.baseball.ui.state.launch
import com.baseball.ui.state.leaguesList
import com.baseball.ui.state.seasonsList
import com.baseball.ui.state.selectedLeagueId
import com.baseball.ui.state.selectedSeasonId
import com.baseball.ui.state.selectedTeamId
import com.baseball.ui.state.teamsList
import kotlinx.browser.document
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

// ── Tab Controllers ──────────────────────────────────────────────────────────

object DashboardTabController {
    fun render(container: HTMLElement) {
        showLoading(container, "Loading Dashboard...")
        launch { setupRender(container) }
    }

    private suspend fun setupRender(container: HTMLElement) {
        try {
            ensureDashboardDataLoaded()
            container.innerHTML = ""

            val dashTab = document.createElement("baseball-dashboard-tab")
            val sId = selectedSeasonId
            if (sId == null) {
                dashTab.setAttribute("no-season", "true")
            } else {
                val dash = api.getSeasonDashboard(sId)
                dashTab.setAttribute("standings-json", Json.encodeToString(dash.standings))
                dashTab.setAttribute("schedule-json", Json.encodeToString<List<Game>>(dash.games))
            }
            container.appendChild(dashTab)
        } catch (e: IllegalStateException) {
            container.innerHTML = ""
            val dashTab = document.createElement("baseball-dashboard-tab")
            dashTab.setAttribute("error-message", e.message ?: "Failed to load dashboard.")
            container.appendChild(dashTab)
        }
    }

    private suspend fun ensureDashboardDataLoaded() {
        if (leaguesList.isEmpty()) leaguesList = api.getLeagues()
        if (selectedLeagueId == null && leaguesList.isNotEmpty()) {
            selectedLeagueId = leaguesList.first().id
        }
        val isSeasonListInvalid = seasonsList.isEmpty() || seasonsList.firstOrNull()?.leagueId != selectedLeagueId
        if (selectedLeagueId != null && isSeasonListInvalid) {
            seasonsList = api.getSeasons(selectedLeagueId!!)
        }
        if (selectedSeasonId == null || seasonsList.none { it.id == selectedSeasonId }) {
            selectedSeasonId = seasonsList.firstOrNull()?.id
        }
    }
}

object ScorerTabController {
    fun render(container: HTMLElement) {
        container.innerHTML = ""
        val game = localGame
        val boxScore = localBoxScore

        val scorerTab = document.createElement("baseball-scorer-tab")
        if (game == null || boxScore == null) {
            scorerTab.setAttribute("no-game", "true")
            container.appendChild(scorerTab)
            return
        }

        scorerTab.setAttribute("away-name", game.awayTeam.name)
        scorerTab.setAttribute("home-name", game.homeTeam.name)

        val sbMount = document.createElement("div") as HTMLElement
        sbMount.setAttribute("slot", "scoreboard")
        mountScoreboard(sbMount, game, boxScore)

        val ctrlMount = document.createElement("div") as HTMLElement
        ctrlMount.setAttribute("slot", "controls")
        val controller = GameScoringController(
            ctrlMount,
            game,
            if (isSingleGameMode) localHomeRoster else emptyList(),
            if (isSingleGameMode) localAwayRoster else emptyList(),
        )
        controller.render()

        val bookMount = document.createElement("div") as HTMLElement
        bookMount.setAttribute("slot", "scorebook")
        renderScorecardSheet(bookMount, game, boxScore, localEvents, game.gameState.half)

        scorerTab.appendChild(sbMount)
        scorerTab.appendChild(ctrlMount)
        scorerTab.appendChild(bookMount)

        container.appendChild(scorerTab)
    }

    private fun mountScoreboard(container: HTMLElement, game: Game, boxScore: BoxScore) {
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
        container.appendChild(scoreboard)
    }
}

object LeaguesTabController {
    fun render(container: HTMLElement) {
        showLoading(container, "Loading Leagues...")
        launch { setupRender(container) }
    }

    private suspend fun setupRender(container: HTMLElement) {
        if (leaguesList.isEmpty()) leaguesList = api.getLeagues()
        val tab = document.createElement("baseball-leagues-tab")
        tab.setAttribute("leagues-json", Json.encodeToString(leaguesList))
        container.innerHTML = ""
        container.appendChild(tab)
    }
}

object TeamsTabController {
    fun render(container: HTMLElement) {
        showLoading(container, "Loading Teams...")
        launch { setupRender(container) }
    }

    private suspend fun setupRender(container: HTMLElement) {
        if (teamsList.isEmpty()) teamsList = api.getTeams()
        val tId = selectedTeamId ?: teamsList.firstOrNull()?.id
        val wrapper = document.createElement("baseball-tab-page-wrapper")
        wrapper.setAttribute("page-title", "Team Rosters")
        if (tId == null) {
            wrapper.setAttribute("empty-message", "No teams available.")
        } else {
            val roster = api.getTeamRoster(tId)
            val rosterTable = document.createElement("baseball-roster-table")
            rosterTable.setAttribute("players-json", Json.encodeToString(roster))
            wrapper.appendChild(rosterTable)
        }
        container.innerHTML = ""
        container.appendChild(wrapper)
    }
}

object StatsTabController {
    fun render(container: HTMLElement) {
        showLoading(container, "Loading Stats...")
        launch { setupRender(container) }
    }

    private suspend fun setupRender(container: HTMLElement) {
        val sId = selectedSeasonId
        val wrapper = document.createElement("baseball-tab-page-wrapper")
        wrapper.setAttribute("page-title", "Season Player Statistics")
        if (sId == null) {
            wrapper.setAttribute("empty-message", "No season selected.")
        } else {
            val seasonStats = api.getSeasonStats(sId)
            val table = document.createElement("baseball-stats-table")
            table.setAttribute("rows-json", Json.encodeToString<List<PlayerBattingStats>>(seasonStats.battingStats))
            wrapper.appendChild(table)
        }
        container.innerHTML = ""
        container.appendChild(wrapper)
    }
}

object BoxScoreTabController {
    fun render(container: HTMLElement) {
        container.innerHTML = ""
        val game = localGame
        val boxScore = localBoxScore
        if (game == null || boxScore == null) {
            val wrapper = document.createElement("baseball-tab-page-wrapper")
            wrapper.setAttribute("empty-message", "No active box score available.")
            container.appendChild(wrapper)
            return
        }
        val maxInning = localEvents.maxOfOrNull { it.inning }?.coerceAtLeast(9) ?: 9
        val scoreboard = document.createElement("baseball-scoreboard")
        scoreboard.setAttribute("away-team", game.awayTeam.name)
        scoreboard.setAttribute("home-team", game.homeTeam.name)
        scoreboard.setAttribute("away-runs", game.awayScore.toString())
        scoreboard.setAttribute("home-runs", game.homeScore.toString())
        scoreboard.setAttribute("away-hits", boxScore.lineScore.awayHits.toString())
        scoreboard.setAttribute("home-hits", boxScore.lineScore.homeHits.toString())
        scoreboard.setAttribute("away-errors", boxScore.lineScore.awayErrors.toString())
        scoreboard.setAttribute("home-errors", boxScore.lineScore.homeErrors.toString())
        scoreboard.setAttribute("current-inning", game.gameState.inning.toString())
        scoreboard.setAttribute("half-inning", game.gameState.half.name)
        scoreboard.setAttribute("outs", game.gameState.outs.toString())
        scoreboard.setAttribute("balls", game.gameState.balls.toString())
        scoreboard.setAttribute("strikes", game.gameState.strikes.toString())
        scoreboard.setAttribute("max-inning", maxInning.toString())
        scoreboard.setAttribute("line-score-json", Json.encodeToString(boxScore.lineScore))
        container.appendChild(scoreboard)
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

private fun showLoading(container: HTMLElement, message: String) {
    container.innerHTML = ""
    val wrapper = document.createElement("baseball-tab-page-wrapper")
    wrapper.setAttribute("loading-message", message)
    container.appendChild(wrapper)
}
