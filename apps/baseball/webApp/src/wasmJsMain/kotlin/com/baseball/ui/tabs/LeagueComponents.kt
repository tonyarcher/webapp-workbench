package com.baseball.ui.tabs

import com.baseball.BaseballConstants
import com.baseball.api
import com.baseball.models.Season
import com.baseball.ui.*
import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.dom.append
import kotlinx.html.js.onClickFunction
import org.w3c.dom.HTMLDivElement

internal fun DIV.renderCreateLeagueCard(refs: LeaguesTabReferences) {
    div(classes = "card") {
        css { marginBottom = UiConstants.CARD_GAP_LARGE }
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

internal fun renderSeasonCardItem(parent: HTMLDivElement, season: Season) {
    parent.append {
        div(classes = "game-card") {
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
}
