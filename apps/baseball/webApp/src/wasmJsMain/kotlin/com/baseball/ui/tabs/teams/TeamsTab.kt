package com.baseball.ui.tabs.teams

import com.baseball.api
import com.baseball.ui.core.launch
import com.baseball.ui.state.selectedTeamId
import com.baseball.ui.state.teamsList
import kotlinx.browser.document
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

internal fun renderTeamsTab(container: HTMLElement) {
    container.innerHTML = "<div class='text-center padding-lg'>Loading Teams...</div>"
    launch { setupRenderTeamsTab(container) }
}

internal suspend fun setupRenderTeamsTab(container: HTMLElement) {
    if (teamsList.isEmpty()) {
        teamsList = api.getTeams()
    }

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
