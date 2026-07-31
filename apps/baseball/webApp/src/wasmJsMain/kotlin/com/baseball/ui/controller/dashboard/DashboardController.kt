package com.baseball.ui.controller.dashboard

import com.baseball.api
import com.baseball.models.Game
import com.baseball.ui.state.launch
import com.baseball.ui.state.leaguesList
import com.baseball.ui.state.seasonsList
import com.baseball.ui.state.selectedLeagueId
import com.baseball.ui.state.selectedSeasonId
import kotlinx.browser.document
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

object DashboardController {
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

    private fun showLoading(container: HTMLElement, message: String) {
        container.innerHTML = ""
        val wrapper = document.createElement("baseball-tab-page-wrapper")
        wrapper.setAttribute("loading-message", message)
        container.appendChild(wrapper)
    }
}
