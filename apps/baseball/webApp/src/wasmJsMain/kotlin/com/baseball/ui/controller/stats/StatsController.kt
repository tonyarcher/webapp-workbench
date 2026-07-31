package com.baseball.ui.controller.stats

import com.baseball.api
import com.baseball.models.PlayerBattingStats
import com.baseball.ui.state.launch
import com.baseball.ui.state.selectedSeasonId
import kotlinx.browser.document
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

object StatsController {
    fun render(container: HTMLElement) {
        showLoading(container, "Loading Stats...")
        launch { setupRender(container) }
    }

    private suspend fun setupRender(container: HTMLElement) {
        val sId = selectedSeasonId
        val wrapper = document.createElement("baseball-tab-page-wrapper")
        wrapper.setAttribute("page-title", "Season Player Statistics")
        if (sId == null) {
            wrapper.setAttribute("empty-message", "No season selected.")
        } else {
            val seasonStats = api.getSeasonStats(sId)
            val table = document.createElement("baseball-stats-table")
            table.setAttribute("rows-json", Json.encodeToString<List<PlayerBattingStats>>(seasonStats.battingStats))
            wrapper.appendChild(table)
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
