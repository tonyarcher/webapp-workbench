package com.baseball.ui

import com.baseball.BaseballConstants
import com.baseball.UiConstants
import com.baseball.api
import com.baseball.models.*
import org.w3c.dom.*
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.css.*

internal fun renderLeaguesTab(container: HTMLElement) {
    container.h1 { +"Leagues & Seasons" }

    var leaguesListDiv: HTMLDivElement? = null
    var seasonsListDiv: HTMLDivElement? = null
    var inputName: HTMLInputElement? = null
    var inputSName: HTMLInputElement? = null
    var inputSYear: HTMLInputElement? = null

    fun refreshLeaguesUI() {
        val divElement = leaguesListDiv ?: return
        divElement.innerHTML = ""
        if (leaguesList.isEmpty()) {
            divElement.p {
                +"No leagues found. Create one to get started!"
                css {
                    color = Color("var(--text-secondary)")
                }
            }
        } else {
            leaguesList.forEach { league ->
                divElement.div(classes = "game-card") {
                    css {
                        marginBottom = 0.75.rem
                        display = Display.flex
                        flexDirection = FlexDirection.column
                        alignItems = Align.flexStart
                    }

                    div {
                        css {
                            fontWeight = FontWeight.bold
                            fontSize = 1.1.rem
                        }
                        +league.name
                    }

                    button(classes = "btn btn-secondary${if (selectedLeagueId == league.id) " active" else ""}") {
                        css {
                            marginTop = 0.5.rem
                            padding = Padding(0.25.rem, 0.75.rem)
                            fontSize = 0.85.rem
                        }
                        +(if (selectedLeagueId == league.id) "Active League" else "Select League")
                        onClickFunction = {
                            selectedLeagueId = league.id
                            launch {
                                seasonsList = api.getSeasons(league.id!!)
                                selectedSeasonId = seasonsList.firstOrNull()?.id
                                refreshLeaguesUI()
                                renderCurrentTab()
                            }
                        }
                    }
                }
            }
        }
    }

    val grid = container.div(classes = "dashboard-grid") {
        div(classes = "card") {
            h2 { +"Available Leagues" }
            div {
                id = "leagues-list-container"
            }
        }

        div {
            div(classes = "card") {
                css {
                    marginBottom = 2.rem
                }
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
                        onClickFunction = {
                            val inName = inputName
                            if (inName != null) {
                                val name = inName.value.trim()
                                if (name.isNotEmpty()) {
                                    launch {
                                        val newLeague = api.createLeague(League(name = name))
                                        leaguesList = api.getLeagues()
                                        selectedLeagueId = newLeague.id
                                        seasonsList = emptyList()
                                        selectedSeasonId = null
                                        inName.value = ""
                                        refreshLeaguesUI()
                                        renderCurrentTab()
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (selectedLeagueId != null) {
                div(classes = "card") {
                    h2 { +"Seasons in Selected League" }
                    div {
                        id = "seasons-list-container"
                        css {
                            marginBottom = 1.5.rem
                        }
                    }

                    h3 { +"Create New Season" }
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
                            onClickFunction = {
                                val sNameIn = inputSName
                                val sYearIn = inputSYear
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
                        }
                    }
                }
            }
        }
    }

    leaguesListDiv = grid.querySelector("#leagues-list-container") as? HTMLDivElement
    seasonsListDiv = grid.querySelector("#seasons-list-container") as? HTMLDivElement
    inputName = grid.querySelector("#league-name-input") as? HTMLInputElement
    inputSName = grid.querySelector("#season-name-input") as? HTMLInputElement
    inputSYear = grid.querySelector("#season-year-input") as? HTMLInputElement

    refreshLeaguesUI()

    if (selectedLeagueId != null) {
        val divElement = seasonsListDiv
        if (divElement != null) {
            divElement.innerHTML = ""
            if (seasonsList.isEmpty()) {
                divElement.p {
                    +"No seasons in this league yet."
                    css {
                        color = Color("var(--text-secondary)")
                    }
                }
            } else {
                seasonsList.forEach { season ->
                    divElement.div(classes = "game-card") {
                        css {
                            marginBottom = 0.5.rem
                            padding = Padding(0.75.rem)
                            display = Display.flex
                            justifyContent = JustifyContent.spaceBetween
                            alignItems = Align.center
                        }

                        span {
                            +"${season.name} (${season.year})"
                            css {
                                fontWeight = FontWeight("600")
                            }
                        }

                        button(classes = "btn btn-secondary") {
                            css {
                                padding = Padding(0.25.rem, 0.5.rem)
                                fontSize = 0.8.rem
                            }
                            +"Go to Dashboard"
                            onClickFunction = {
                                selectedSeasonId = season.id
                                currentTab = BaseballConstants.TAB_GAMES
                                updateActiveTabButtons()
                                renderCurrentTab()
                            }
                        }
                    }
                }
            }
        }
    }
}
