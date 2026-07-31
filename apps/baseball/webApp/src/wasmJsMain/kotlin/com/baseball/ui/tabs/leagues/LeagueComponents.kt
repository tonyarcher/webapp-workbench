package com.baseball.ui.tabs.leagues

import com.baseball.api
import com.baseball.models.Season
import com.baseball.ui.core.launch
import com.baseball.ui.state.NavTabs
import com.baseball.ui.state.currentTab
import com.baseball.ui.state.leaguesList
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.saveNavState
import com.baseball.ui.state.seasonsList
import com.baseball.ui.state.selectedLeagueId
import com.baseball.ui.state.selectedSeasonId
import kotlinx.html.ButtonType
import kotlinx.html.DIV
import kotlinx.html.InputType
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.form
import kotlinx.html.h2
import kotlinx.html.h3
import kotlinx.html.id
import kotlinx.html.input
import kotlinx.html.js.onClickFunction
import kotlinx.html.label
import kotlinx.html.span
import org.w3c.dom.HTMLDivElement

internal fun DIV.renderCreateLeagueCard(refs: LeaguesTabReferences) {
    div(classes = "card margin-bottom-lg") {
        h2 { +"Create New League" }
        renderCreateLeagueForm(refs)
    }
}

private fun DIV.renderCreateLeagueForm(refs: LeaguesTabReferences) {
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

private fun handleCreateLeagueClick(refs: LeaguesTabReferences) {
    val inName = refs.inputName
    if (inName != null && inName.value.trim().isNotEmpty()) {
        val name = inName.value.trim()
        launch {
            val newLeague = api.createLeague(com.baseball.models.League(name = name))
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

internal fun DIV.renderSeasonsSection(refs: LeaguesTabReferences) {
    div(classes = "card") {
        h2 { +"Seasons in Selected League" }
        div(classes = "margin-bottom-lg") {
            id = "seasons-list-container"
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

internal fun renderSeasonCardItem(parent: HTMLDivElement, season: Season) {
    parent.append {
        div(classes = "game-card flex-between margin-bottom-sm") {
            span(classes = "font-bold") {
                +"${season.name} (${season.year})"
            }

            button(classes = "btn btn-secondary font-small") {
                +"Go to Dashboard"
                onClickFunction = {
                    selectedSeasonId = season.id
                    saveNavState()
                    currentTab = NavTabs.TAB_GAMES
                }
            }
        }
    }
}
