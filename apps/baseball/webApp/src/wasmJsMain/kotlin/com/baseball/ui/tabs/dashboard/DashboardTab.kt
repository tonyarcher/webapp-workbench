package com.baseball.ui.tabs.dashboard

import com.baseball.api
import com.baseball.ui.core.launch
import com.baseball.ui.state.leaguesList
import com.baseball.ui.state.seasonsList
import com.baseball.ui.state.selectedLeagueId
import com.baseball.ui.state.selectedSeasonId
import kotlinx.html.dom.append
import kotlinx.html.h1
import org.w3c.dom.HTMLElement

internal fun renderSeasonDashboardTab(container: HTMLElement) {
    showDashboardLoading(container)
    launch { setupRenderSeasonDashboardTab(container) }
}

internal suspend fun setupRenderSeasonDashboardTab(container: HTMLElement) {
    try {
        ensureDashboardDataLoaded()
        container.innerHTML = ""
        container.append {
            h1 { +"Season Dashboard" }
        }

        renderSeasonSelectorCard(container)

        if (selectedSeasonId == null) {
            showNoSeasonSelectedMessage(container)
            return
        }

        val dash = api.getSeasonDashboard(selectedSeasonId!!)
        renderDashboardContent(container, dash)
    } catch (e: Throwable) {
        renderDashboardError(container, e)
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
