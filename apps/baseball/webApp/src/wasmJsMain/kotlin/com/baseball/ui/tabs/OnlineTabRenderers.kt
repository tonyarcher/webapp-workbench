package com.baseball.ui.tabs

import com.baseball.api
import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.game.localGame
import com.baseball.models.PlayerBattingStats
import com.baseball.ui.state.launch
import com.baseball.ui.state.selectedSeasonId
import com.baseball.ui.state.selectedTeamId
import com.baseball.ui.state.leaguesList
import com.baseball.ui.state.teamsList
import kotlinx.browser.document
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

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
