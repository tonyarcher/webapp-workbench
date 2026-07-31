package com.baseball.ui.tabs.teams

import com.baseball.api
import com.baseball.ui.core.launch
import com.baseball.ui.state.selectedTeamId
import com.baseball.ui.state.teamsList
import kotlinx.browser.document
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

internal fun renderTeamsTab(container: HTMLElement) {
    container.innerHTML = "<div class='text-center padding-lg'>Loading Teams...</div>"
    launch { setupRenderTeamsTab(container) }
}

internal suspend fun setupRenderTeamsTab(container: HTMLElement) {
    container.innerHTML = ""

    val title = document.createElement("h1")
    title.textContent = "Team Rosters"
    container.appendChild(title)

    if (teamsList.isEmpty()) {
        teamsList = api.getTeams()
    }

    val tId = selectedTeamId ?: teamsList.firstOrNull()?.id
    if (tId == null) {
        val msg = document.createElement("p")
        msg.textContent = "No teams available."
        container.appendChild(msg)
        return
    }

    val roster = api.getTeamRoster(tId)
    val rosterTable = document.createElement("baseball-roster-table")
    rosterTable.setAttribute("roster-json", Json.encodeToString(roster))
    container.appendChild(rosterTable)
}
