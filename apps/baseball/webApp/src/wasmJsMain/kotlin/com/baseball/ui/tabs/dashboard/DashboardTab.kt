package com.baseball.ui.tabs.dashboard

import com.baseball.api
import com.baseball.models.Game
import com.baseball.ui.core.launch
import com.baseball.ui.state.leaguesList
import com.baseball.ui.state.seasonsList
import com.baseball.ui.state.selectedLeagueId
import com.baseball.ui.state.selectedSeasonId
import kotlinx.browser.document
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

internal fun renderSeasonDashboardTab(container: HTMLElement) {
    container.innerHTML = "<div class='text-center padding-lg'>Loading Dashboard...</div>"
    launch { setupRenderSeasonDashboardTab(container) }
}

internal suspend fun setupRenderSeasonDashboardTab(container: HTMLElement) {
    try {
        ensureDashboardDataLoaded()
        container.innerHTML = ""

        val title = document.createElement("h1")
        title.textContent = "Season Dashboard"
        container.appendChild(title)

        val sId = selectedSeasonId
        if (sId == null) {
            val msg = document.createElement("p")
            msg.textContent = "No season selected. Please select a season."
            container.appendChild(msg)
            return
        }

        val dash = api.getSeasonDashboard(sId)

        val standingsTable = document.createElement("baseball-standings-table")
        standingsTable.setAttribute("standings-json", Json.encodeToString(dash.standings))
        container.appendChild(standingsTable)

        val scheduleList = document.createElement("baseball-schedule-list")
        scheduleList.setAttribute("schedule-json", Json.encodeToString<List<Game>>(dash.games))
        container.appendChild(scheduleList)
    } catch (e: IllegalStateException) {
        val err = document.createElement("div")
        err.className = "server-error-banner"
        err.textContent = e.message ?: "Failed to load dashboard."
        container.appendChild(err)
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
