package com.baseball.ui.controller.teams

import com.baseball.api
import com.baseball.ui.state.launch
import com.baseball.ui.state.selectedTeamId
import com.baseball.ui.state.teamsList
import kotlinx.browser.document
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

object TeamsController {
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

    private fun showLoading(container: HTMLElement, message: String) {
        container.innerHTML = ""
        val wrapper = document.createElement("baseball-tab-page-wrapper")
        wrapper.setAttribute("loading-message", message)
        container.appendChild(wrapper)
    }
}
