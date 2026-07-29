package com.baseball.ui.tabs.dashboard

import com.baseball.api
import com.baseball.models.SeasonDashboard
import com.baseball.ui.UiConstants
import com.baseball.ui.css
import com.baseball.ui.launch
import com.baseball.ui.leaguesList
import com.baseball.ui.renderCurrentTab
import com.baseball.ui.saveNavState
import com.baseball.ui.seasonsList
import com.baseball.ui.selectedLeagueId
import com.baseball.ui.selectedSeasonId
import kotlinx.css.Align
import kotlinx.css.Display
import kotlinx.css.alignItems
import kotlinx.css.display
import kotlinx.css.flexGrow
import kotlinx.css.gap
import kotlinx.css.marginBottom
import kotlinx.css.px
import kotlinx.html.DIV
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.id
import kotlinx.html.js.onChangeFunction
import kotlinx.html.js.onClickFunction
import kotlinx.html.label
import kotlinx.html.option
import kotlinx.html.select
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLSelectElement

internal fun renderSeasonSelectorCard(container: HTMLElement): SeasonSelectorControls {
    container.append {
        div(classes = "card") {
            id = "season-selector-card"
            css {
                marginBottom = UiConstants.CARD_MARGIN_BOTTOM
                display = Display.flex; gap = UiConstants.CARD_GAP_LARGE; alignItems = Align.flexEnd
            }
            renderLeagueDropdownField()
            renderActiveSeasonField()
            renderLoadSeasonButton(container)
        }
    }

    val card = container.querySelector("#season-selector-card") as HTMLElement
    val selectS = card.querySelector("#select-season-dropdown") as? HTMLSelectElement
    populateDashboardSeasonsDropdown(selectS)
    return SeasonSelectorControls(selectS)
}

private fun DIV.renderActiveSeasonField() {
    div(classes = "form-group") {
        css { marginBottom = 0.px; flexGrow = 1.0 }
        label { +"Active Season" }
        select(classes = "form-control") { id = "select-season-dropdown" }
    }
}

private fun DIV.renderLoadSeasonButton(container: HTMLElement) {
    button(classes = "btn") {
        id = "load-season-btn"
        +"Load Season"
        onClickFunction = {
            val selectSInput = container.querySelector("#select-season-dropdown") as? HTMLSelectElement
            selectedSeasonId = selectSInput?.value?.toLongOrNull()
            saveNavState()
            renderCurrentTab()
        }
    }
}

private fun DIV.renderLeagueDropdownField() {
    div(classes = "form-group") {
        css { marginBottom = 0.px; flexGrow = 1.0 }
        label { +"Active League" }
        select(classes = "form-control") {
            id = "select-league-dropdown"
            leaguesList.forEach { league ->
                option {
                    value = league.id.toString()
                    +league.name
                    selected = (selectedLeagueId == league.id)
                }
            }
            onChangeFunction = { event ->
                (event.target as? HTMLSelectElement)?.value?.toLongOrNull()?.let { lid ->
                    selectedLeagueId = lid
                    launch {
                        seasonsList = api.getSeasons(lid)
                        selectedSeasonId = seasonsList.firstOrNull()?.id
                        saveNavState()
                        renderCurrentTab()
                    }
                }
            }
        }
    }
}

internal fun populateDashboardSeasonsDropdown(selectEl: HTMLSelectElement?) {
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

internal fun renderDashboardContent(container: HTMLElement, dash: SeasonDashboard) {
    container.append {
        div(classes = "dashboard-grid") {
            renderStandingsCard(dash.standings)
            div {
                renderScheduleManagerCard(dash.games)
                renderGamesListCard(dash.games)
            }
        }
    }
}
