package com.baseball.ui.controller.leagues

import com.baseball.api
import com.baseball.ui.state.launch
import com.baseball.ui.state.leaguesList
import kotlinx.browser.document
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

object LeaguesController {
    fun render(container: HTMLElement) {
        showLoading(container, "Loading Leagues...")
        launch { setupRender(container) }
    }

    private suspend fun setupRender(container: HTMLElement) {
        if (leaguesList.isEmpty()) leaguesList = api.getLeagues()
        val tab = document.createElement("baseball-leagues-tab")
        tab.setAttribute("leagues-json", Json.encodeToString(leaguesList))
        container.innerHTML = ""
        container.appendChild(tab)
    }

    private fun showLoading(container: HTMLElement, message: String) {
        container.innerHTML = ""
        val wrapper = document.createElement("baseball-tab-page-wrapper")
        wrapper.setAttribute("loading-message", message)
        container.appendChild(wrapper)
    }
}
