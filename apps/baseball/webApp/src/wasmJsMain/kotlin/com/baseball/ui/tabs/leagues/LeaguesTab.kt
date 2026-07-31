package com.baseball.ui.tabs.leagues

import com.baseball.api
import com.baseball.ui.core.launch
import com.baseball.ui.state.leaguesList
import kotlinx.browser.document
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

internal fun renderLeaguesTab(container: HTMLElement) {
    container.innerHTML = "<div class='text-center padding-lg'>Loading Leagues...</div>"
    launch { setupRenderLeaguesTab(container) }
}

internal suspend fun setupRenderLeaguesTab(container: HTMLElement) {
    if (leaguesList.isEmpty()) {
        leaguesList = api.getLeagues()
    }
    val tab = document.createElement("baseball-leagues-tab")
    tab.setAttribute("leagues-json", Json.encodeToString(leaguesList))
    container.innerHTML = ""
    container.appendChild(tab)
}
