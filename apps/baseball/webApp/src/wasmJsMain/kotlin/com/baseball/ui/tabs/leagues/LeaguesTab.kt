package com.baseball.ui.tabs.leagues

import com.baseball.api
import com.baseball.ui.core.launch
import com.baseball.ui.state.leaguesList
import kotlinx.browser.document
import org.w3c.dom.HTMLElement

internal fun renderLeaguesTab(container: HTMLElement) {
    container.innerHTML = "<div class='text-center padding-lg'>Loading Leagues...</div>"
    launch { setupRenderLeaguesTab(container) }
}

internal suspend fun setupRenderLeaguesTab(container: HTMLElement) {
    container.innerHTML = ""

    val title = document.createElement("h1")
    title.textContent = "League Directory"
    container.appendChild(title)

    if (leaguesList.isEmpty()) {
        leaguesList = api.getLeagues()
    }

    val grid = document.createElement("div")
    grid.className = "action-grid-2col"

    leaguesList.forEach { league ->
        val card = document.createElement("baseball-league-card")
        card.setAttribute("league-name", league.name)
        card.setAttribute("league-details", "Official League #${league.id}")
        grid.appendChild(card)
    }

    container.appendChild(grid)
}
