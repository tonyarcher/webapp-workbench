package com.baseball.ui.tabs.stats

import com.baseball.api
import com.baseball.ui.core.UiConstants
import com.baseball.ui.core.css
import com.baseball.ui.core.launch
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.seasonsList
import com.baseball.ui.state.selectedSeasonId
import com.baseball.ui.state.teamsList
import kotlinx.css.Align
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.TextAlign
import kotlinx.css.alignItems
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexGrow
import kotlinx.css.gap
import kotlinx.css.marginBottom
import kotlinx.css.padding
import kotlinx.css.px
import kotlinx.css.textAlign
import kotlinx.html.DIV
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h2
import kotlinx.html.id
import kotlinx.html.js.onChangeFunction
import kotlinx.html.js.onClickFunction
import kotlinx.html.js.option
import kotlinx.html.label
import kotlinx.html.option
import kotlinx.html.p
import kotlinx.html.select
import kotlinx.html.table
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLSelectElement
import org.w3c.dom.events.Event

internal fun renderStatsFilterCard(container: HTMLElement): Pair<HTMLSelectElement?, HTMLSelectElement?> {
    container.append {
        div(classes = "dashboard-grid") {
            css {
                marginBottom = UiConstants.CARD_MARGIN_BOTTOM
                display = Display.flex
                gap = UiConstants.CARD_GAP_LARGE
                alignItems = Align.flexEnd
            }
            renderSeasonDropdownGroup()
            renderTeamDropdownGroup()
            renderLoadStatsBtn(container)
        }
    }

    val filterCard = container.querySelector(".dashboard-grid") as? HTMLDivElement
    val selectS = filterCard?.querySelector("#stats-season-dropdown") as? HTMLSelectElement
    val selectT = filterCard?.querySelector("#stats-team-dropdown") as? HTMLSelectElement
    return Pair(selectS, selectT)
}

private fun DIV.renderSeasonDropdownGroup() {
    div(classes = "form-group") {
        css { marginBottom = 0.px; flexGrow = 1.0 }
        label { +"Select Season" }
        select(classes = "form-control") { id = "stats-season-dropdown" }
    }
}

private fun DIV.renderTeamDropdownGroup() {
    div(classes = "form-group") {
        css { marginBottom = 0.px; flexGrow = 1.0 }
        label { +"Filter by Team" }
        select(classes = "form-control") {
            id = "stats-team-dropdown"
            option {
                value = ""
                +"All Teams"
                selected = (statsSelectedTeamId == null)
            }
            teamsList.forEach { team ->
                option {
                    value = team.id.toString()
                    +"${team.city} ${team.name}"
                    selected = (statsSelectedTeamId == team.id)
                }
            }
            onChangeFunction = { event ->
                statsSelectedTeamId = (event.target as? HTMLSelectElement)?.value?.toLongOrNull()
                renderCurrentTab()
            }
        }
    }
}

private fun DIV.renderLoadStatsBtn(container: HTMLElement) {
    button(classes = "btn") {
        id = "load-stats-btn"
        +"Load Statistics"
        onClickFunction = { _: Event ->
            val selectS = container.querySelector("#stats-season-dropdown") as? HTMLSelectElement
            selectedSeasonId = selectS?.value?.toLongOrNull()
            renderCurrentTab()
        }
    }
}

internal fun populateStatsSeasonsDropdown(selectEl: HTMLSelectElement?) {
    if (selectEl == null) return
    selectEl.innerHTML = ""
    seasonsList.forEach { season ->
        selectEl.append.option {
            value = season.id.toString()
            +"${season.name} (${season.year})"
            selected = (selectedSeasonId == season.id)
        }
    }
}

internal fun renderNoSeasonSelectedCard(container: HTMLElement) {
    container.append {
        div(classes = "card") {
            css { textAlign = TextAlign.center; padding = UiConstants.CARD_PADDING_LARGE }
            p {
                +"Please select a season, then click Load Statistics."
                css { color = Color("var(--text-secondary)") }
            }
        }
    }
}

internal fun renderStatsSubTabToggle(container: HTMLElement) {
    container.append {
        div {
            css { display = Display.flex; gap = UiConstants.CARD_GAP; marginBottom = UiConstants.CARD_GAP_LARGE }
            renderSubTabBtn("Batting", "batting")
            renderSubTabBtn("Pitching", "pitching")
            renderSubTabBtn("Fielding", "fielding")
        }
    }
}

private fun DIV.renderSubTabBtn(label: String, tabName: String) {
    button(classes = "btn${if (selectedStatsSubTab == tabName) "" else " btn-secondary"}") {
        +label
        onClickFunction = { _: Event ->
            selectedStatsSubTab = tabName
            renderCurrentTab()
        }
    }
}

internal fun renderStatsTableSection(container: HTMLElement) {
    launch {
        val stats = api.getSeasonStats(selectedSeasonId!!)
        val playersList = api.getPlayers()

        container.append {
            div(classes = "card") {
                h2 { +"${selectedStatsSubTab.replaceFirstChar { it.uppercaseChar() }} Statistics" }
                div(classes = "table-container") {
                    table {
                        when (selectedStatsSubTab) {
                            "batting" -> renderBattingTable(this, stats, playersList)
                            "pitching" -> renderPitchingTable(this, stats, playersList)
                            "fielding" -> renderFieldingTable(this, stats, playersList)
                        }
                    }
                }
            }
        }
    }
}
