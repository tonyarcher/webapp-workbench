package com.baseball.ui.tabs.stats

import com.baseball.api
import com.baseball.models.PlayerBattingStats
import com.baseball.ui.core.launch
import com.baseball.ui.state.selectedSeasonId
import kotlinx.browser.document
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

internal fun renderStatsTab(container: HTMLElement) {
    container.innerHTML = "<div class='text-center padding-lg'>Loading Stats...</div>"
    launch { setupRenderStatsTab(container) }
}

internal suspend fun setupRenderStatsTab(container: HTMLElement) {
    val sId = selectedSeasonId
    if (sId == null) {
        container.innerHTML = "<h1>Season Player Statistics</h1><p>No season selected.</p>"
        return
    }

    val seasonStats = api.getSeasonStats(sId)
    val table = document.createElement("baseball-stats-table")
    table.setAttribute("rows-json", Json.encodeToString<List<PlayerBattingStats>>(seasonStats.battingStats))
    container.innerHTML = "<h1>Season Player Statistics</h1>"
    container.appendChild(table)
}
