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

// ── Dashboard ────────────────────────────────────────────────────────────────

internal fun renderSeasonDashboardTab(container: HTMLElement) {
    container.innerHTML = "<div class='text-center padding-lg'>Loading Dashboard...</div>"
    launch { setupRenderSeasonDashboardTab(container) }
}

private suspend fun setupRenderSeasonDashboardTab(container: HTMLElement) {
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
    if (leaguesList.isEmpty()) {
        leaguesList = api.getLeagues()
    }
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

// ── Scorer ───────────────────────────────────────────────────────────────────

internal fun renderScorerTab(container: HTMLElement) {
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

// ── Leagues ──────────────────────────────────────────────────────────────────

internal fun renderLeaguesTab(container: HTMLElement) {
    container.innerHTML = "<div class='text-center padding-lg'>Loading Leagues...</div>"
    launch { setupRenderLeaguesTab(container) }
}

private suspend fun setupRenderLeaguesTab(container: HTMLElement) {
    if (leaguesList.isEmpty()) leaguesList = api.getLeagues()
    val tab = document.createElement("baseball-leagues-tab")
    tab.setAttribute("leagues-json", Json.encodeToString(leaguesList))
    container.innerHTML = ""
    container.appendChild(tab)
}

// ── Teams ─────────────────────────────────────────────────────────────────────

internal fun renderTeamsTab(container: HTMLElement) {
    container.innerHTML = "<div class='text-center padding-lg'>Loading Teams...</div>"
    launch { setupRenderTeamsTab(container) }
}

private suspend fun setupRenderTeamsTab(container: HTMLElement) {
    if (teamsList.isEmpty()) teamsList = api.getTeams()
    val tId = selectedTeamId ?: teamsList.firstOrNull()?.id
    if (tId == null) {
        container.innerHTML = "<h1>Team Rosters</h1><p>No teams available.</p>"
        return
    }
    val roster = api.getTeamRoster(tId)
    val rosterTable = document.createElement("baseball-roster-table")
    rosterTable.setAttribute("players-json", Json.encodeToString(roster))
    container.innerHTML = "<h1>Team Rosters</h1>"
    container.appendChild(rosterTable)
}

// ── Stats ─────────────────────────────────────────────────────────────────────

internal fun renderStatsTab(container: HTMLElement) {
    container.innerHTML = "<div class='text-center padding-lg'>Loading Stats...</div>"
    launch { setupRenderStatsTab(container) }
}

private suspend fun setupRenderStatsTab(container: HTMLElement) {
    val sId = selectedSeasonId
    if (sId == null) {
        container.innerHTML = "<h1>Season Player Statistics</h1><p>No season selected.</p>"
        return
    }
    val seasonStats = api.getSeasonStats(sId)
    val table = document.createElement("baseball-stats-table")
    table.setAttribute("rows-json", Json.encodeToString<List<PlayerBattingStats>>(seasonStats.battingStats))
    container.innerHTML = "<h1>Season Player Statistics</h1>"
    container.appendChild(table)
}

// ── Box Score ─────────────────────────────────────────────────────────────────

internal fun renderBoxScoreTab(container: HTMLElement) {
    container.innerHTML = ""
    val game = localGame
    val boxScore = localBoxScore
    if (game == null || boxScore == null) {
        container.innerHTML = "<p>No active box score available.</p>"
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
