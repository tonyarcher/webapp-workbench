

package com.baseball.ui.tabs


import com.baseball.BaseballConstants
import com.baseball.api
import com.baseball.models.League
import com.baseball.models.Season
import com.baseball.ui.*

import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.js.onClickFunction
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLInputElement

internal fun renderLeaguesTab(container: HTMLElement) {
    container.h1 { +"Leagues & Seasons" }

    val references = LeaguesTabReferences()

    val grid = container.div(classes = "dashboard-grid") {
        renderLeaguesListCard()
        div {
            renderCreateLeagueCard(references)
            if (selectedLeagueId != null) {
                renderSeasonsSection(references)
            }
        }
    }

    references.bind(grid)
    references.refreshLeaguesUI()
    references.refreshSeasonsUI()
}

private class LeaguesTabReferences {
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
            divElement.p {
                +"No leagues found. Create one to get started!"
                css { color = Color("var(--text-secondary)") }
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
            divElement.p {
                +"No seasons in this league yet."
                css { color = Color("var(--text-secondary)") }
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
    parent.div(classes = "game-card") {
        css {
            marginBottom = UiConstants.CARD_MARGIN_BOTTOM
            display = Display.flex
            flexDirection = FlexDirection.column
            alignItems = Align.flexStart
        }

        div {
            css {
                fontWeight = FontWeight.bold
                fontSize = UiConstants.FONT_SIZE_LARGE
            }
            +league.name
        }

        val isSelected = (selectedLeagueId == league.id)
        button(classes = "btn btn-secondary${if (isSelected) " active" else ""}") {
            css {
                marginTop = UiConstants.CARD_GAP_SMALL
                padding = Padding(0.25.rem, 0.75.rem)
                fontSize = 0.85.rem
            }
            +(if (isSelected) "Active League" else "Select League")
            onClickFunction = {
                selectedLeagueId = league.id
                launch {
                    seasonsList = api.getSeasons(league.id!!)
                    selectedSeasonId = seasonsList.firstOrNull()?.id
                    refs.refreshLeaguesUI()
                    renderCurrentTab()
                }
            }
        }
    }
}

private fun DIV.renderCreateLeagueCard(refs: LeaguesTabReferences) {
    div(classes = "card") {
        css { marginBottom = UiConstants.CARD_MARGIN_BOTTOM }
        h2 { +"Create New League" }
        form {
            div(classes = "form-group") {
                label { +"League Name" }
                input(type = InputType.text, classes = "form-control") {
                    id = "league-name-input"
                    placeholder = "e.g., National Baseball League"
                }
            }
            button(classes = "btn") {
                type = ButtonType.button
                +"Create League"
                onClickFunction = { handleCreateLeagueClick(refs) }
            }
        }
    }
}

private fun handleCreateLeagueClick(refs: LeaguesTabReferences) {
    val inName = refs.inputName ?: return
    val name = inName.value.trim()
    if (name.isNotEmpty()) {
        launch {
            val newLeague = api.createLeague(League(name = name))
            leaguesList = api.getLeagues()
            selectedLeagueId = newLeague.id
            seasonsList = emptyList()
            selectedSeasonId = null
            inName.value = ""
            refs.refreshLeaguesUI()
            renderCurrentTab()
        }
    }
}

private fun DIV.renderSeasonsSection(refs: LeaguesTabReferences) {
    div(classes = "card") {
        h2 { +"Seasons in Selected League" }
        div {
            id = "seasons-list-container"
            css { marginBottom = UiConstants.CARD_GAP_LARGE }
        }

        h3 { +"Create New Season" }
        renderCreateSeasonForm(refs)
    }
}

private fun DIV.renderCreateSeasonForm(refs: LeaguesTabReferences) {
    form {
        div(classes = "form-group") {
            label { +"Season Name" }
            input(type = InputType.text, classes = "form-control") {
                id = "season-name-input"
                placeholder = "e.g., 2026 Regular Season"
            }
        }
        div(classes = "form-group") {
            label { +"Year" }
            input(type = InputType.number, classes = "form-control") {
                id = "season-year-input"
                value = "2026"
            }
        }
        button(classes = "btn") {
            type = ButtonType.button
            +"Create Season"
            onClickFunction = { handleCreateSeasonClick(refs) }
        }
    }
}

private fun handleCreateSeasonClick(refs: LeaguesTabReferences) {
    val sNameIn = refs.inputSName
    val sYearIn = refs.inputSYear
    if (sNameIn != null && sYearIn != null) {
        val name = sNameIn.value.trim()
        val yearStr = sYearIn.value.trim()
        if (name.isNotEmpty() && yearStr.isNotEmpty()) {
            launch {
                api.createSeason(Season(leagueId = selectedLeagueId!!, name = name, year = yearStr.toInt()))
                seasonsList = api.getSeasons(selectedLeagueId!!)
                sNameIn.value = ""
                renderCurrentTab()
            }
        }
    }
}

private fun renderSeasonCardItem(parent: HTMLDivElement, season: Season) {
    parent.div(classes = "game-card") {
        css {
            marginBottom = UiConstants.CARD_GAP_SMALL
            padding = UiConstants.CARD_PADDING
            display = Display.flex
            justifyContent = JustifyContent.spaceBetween
            alignItems = Align.center
        }

        span {
            +"${season.name} (${season.year})"
            css { fontWeight = FontWeight("600") }
        }

        button(classes = "btn btn-secondary") {
            css {
                padding = Padding(0.25.rem, 0.5.rem)
                fontSize = 0.8.rem
            }
            +"Go to Dashboard"
            onClickFunction = {
                selectedSeasonId = season.id
                saveNavState()
                currentTab = BaseballConstants.TAB_GAMES
            }
        }
    }
}
