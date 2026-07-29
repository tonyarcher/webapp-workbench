package com.baseball.ui.tabs.stats

import com.baseball.ui.launch
import com.baseball.ui.selectedSeasonId
import kotlinx.html.dom.append
import kotlinx.html.h1
import org.w3c.dom.HTMLElement

internal var selectedStatsSubTab = "batting" // batting, pitching, fielding
internal var statsSelectedTeamId: Long? = null // null means All Teams

internal fun renderStatsTab(container: HTMLElement) {
    launch { setupRenderStatsTab(container) }
}

internal suspend fun setupRenderStatsTab(container: HTMLElement) {
    container.append {
        h1 { +"Season Player Statistics" }
    }
    val (selectS, _) = renderStatsFilterCard(container)
    populateStatsSeasonsDropdown(selectS)
    if (selectedSeasonId == null) {
        renderNoSeasonSelectedCard(container)
        return
    }
    renderStatsSubTabToggle(container)
    renderStatsTableSection(container)
}
