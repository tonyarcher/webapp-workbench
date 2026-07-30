package com.baseball.ui.tabs.leagues

import com.baseball.api
import com.baseball.models.League
import com.baseball.ui.core.UiConstants
import com.baseball.ui.core.css
import com.baseball.ui.core.launch
import com.baseball.ui.state.leaguesList
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.saveNavState
import com.baseball.ui.state.seasonsList
import com.baseball.ui.state.selectedLeagueId
import com.baseball.ui.state.selectedSeasonId
import kotlinx.css.Align
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.FontWeight
import kotlinx.css.JustifyContent
import kotlinx.css.Padding
import kotlinx.css.alignItems
import kotlinx.css.border
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.justifyContent
import kotlinx.css.marginBottom
import kotlinx.css.padding
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.html.DIV
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h1
import kotlinx.html.h2
import kotlinx.html.id
import kotlinx.html.js.onClickFunction
import kotlinx.html.p
import kotlinx.html.span
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLInputElement

internal fun renderLeaguesTab(container: HTMLElement) {
    container.innerHTML = ""
    container.append {
        h1 { +"Leagues & Seasons" }
    }

    val references = LeaguesTabReferences()

    container.append {
        div(classes = "dashboard-grid") {
            id = "leagues-grid"
            renderLeaguesListCard()
            div {
                renderCreateLeagueCard(references)
                if (selectedLeagueId != null) {
                    renderSeasonsSection(references)
                }
            }
        }
    }
    val grid = container.querySelector("#leagues-grid") as HTMLDivElement

    references.bind(grid)
    references.refreshLeaguesUI()
    references.refreshSeasonsUI()
}

internal class LeaguesTabReferences {
    var leaguesListDiv: HTMLDivElement? = null
    var seasonsListDiv: HTMLDivElement? = null
    var inputName: HTMLInputElement? = null
    var inputSName: HTMLInputElement? = null
    var inputSYear: HTMLInputElement? = null

    fun bind(grid: HTMLDivElement) {
        leaguesListDiv = grid.querySelector("#leagues-list-container") as? HTMLDivElement
        seasonsListDiv = grid.querySelector("#seasons-list-container") as? HTMLDivElement
        inputName = grid.querySelector("#league-name-input") as? HTMLInputElement
        inputSName = grid.querySelector("#season-name-input") as? HTMLInputElement
        inputSYear = grid.querySelector("#season-year-input") as? HTMLInputElement
    }

    fun refreshLeaguesUI() {
        val divElement = leaguesListDiv ?: return
        divElement.innerHTML = ""
        if (leaguesList.isEmpty()) {
            divElement.append {
                p {
                    +"No leagues found. Create one to get started!"
                    css { color = Color("var(--text-secondary)") }
                }
            }
        } else {
            leaguesList.forEach { league ->
                renderLeagueCardItem(divElement, league, this)
            }
        }
    }

    fun refreshSeasonsUI() {
        if (selectedLeagueId == null) return
        val divElement = seasonsListDiv ?: return
        divElement.innerHTML = ""
        if (seasonsList.isEmpty()) {
            divElement.append {
                p {
                    +"No seasons in this league yet."
                    css { color = Color("var(--text-secondary)") }
                }
            }
        } else {
            seasonsList.forEach { season ->
                renderSeasonCardItem(divElement, season)
            }
        }
    }
}

private fun DIV.renderLeaguesListCard() {
    div(classes = "card") {
        h2 { +"Available Leagues" }
        div {
            id = "leagues-list-container"
        }
    }
}

private fun renderLeagueCardItem(parent: HTMLDivElement, league: League, refs: LeaguesTabReferences) {
    parent.append {
        div(classes = "game-card") {
            css {
                marginBottom = UiConstants.CARD_GAP_SMALL
                padding = UiConstants.CARD_PADDING
                display = Display.flex
                justifyContent = JustifyContent.spaceBetween
                alignItems = Align.center
                if (selectedLeagueId == league.id) {
                    border = Border(1.px, BorderStyle.solid, Color("var(--primary)"))
                }
            }

            span {
                +league.name
                css { fontWeight = FontWeight("600") }
            }

            button(classes = if (selectedLeagueId == league.id) "btn btn-primary" else "btn btn-secondary") {
                css {
                    padding = Padding(0.25.rem, 0.5.rem)
                    fontSize = 0.8.rem
                }
                +"${if (selectedLeagueId == league.id) "Selected" else "Select"}"
                onClickFunction = { handleSelectLeagueClick(league, refs) }
            }
        }
    }
}

private fun handleSelectLeagueClick(league: League, refs: LeaguesTabReferences) {
    selectedLeagueId = league.id
    selectedSeasonId = null
    seasonsList = emptyList()
    saveNavState()
    refs.refreshLeaguesUI()
    launch {
        seasonsList = api.getSeasons(league.id!!)
        if (seasonsList.isNotEmpty()) {
            selectedSeasonId = seasonsList.first().id
            saveNavState()
        }
        renderCurrentTab()
    }
}
