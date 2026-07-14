package com.baseball.ui

import com.baseball.BaseballConstants
import com.baseball.UiConstants
import com.baseball.api
import com.baseball.models.*
import org.w3c.dom.*
import kotlinx.browser.document
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.dom.*

internal fun renderSeasonDashboardTab(container: HTMLElement) {
    container.h1 { +"Season Dashboard" }

    var selectL: HTMLSelectElement? = null
    var selectS: HTMLSelectElement? = null
    var fetchBtn: HTMLButtonElement? = null

    fun populateSeasonsDropdown() {
        val selectEl = selectS ?: return
        selectEl.innerHTML = ""
        seasonsList.forEach { season ->
            selectEl.append.option {
                value = season.id.toString()
                +"${season.name} (${season.year})"
                selected = (selectedSeasonId == season.id)
            }
        }
    }

    val card = container.div(classes = "card") {
        style = "margin-bottom: 2rem; display: flex; gap: 1.5rem; align-items: flex-end;"

        div(classes = "form-group") {
            style = "margin-bottom: 0; flex: 1;"
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
                    val lid = (event.target as? HTMLSelectElement)?.value?.toLongOrNull()
                    if (lid != null) {
                        selectedLeagueId = lid
                        launch {
                            seasonsList = api.getSeasons(lid)
                            selectedSeasonId = seasonsList.firstOrNull()?.id
                            populateSeasonsDropdown()
                        }
                    }
                }
            }
        }

        div(classes = "form-group") {
            style = "margin-bottom: 0; flex: 1;"
            label { +"Active Season" }
            select(classes = "form-control") {
                id = "select-season-dropdown"
            }
        }

        button(classes = "btn") {
            id = "load-season-btn"
            +"Load Season"
            onClickFunction = {
                selectedSeasonId = selectS?.value?.toLongOrNull()
                renderCurrentTab()
            }
        }
    }

    selectL = card.querySelector("#select-league-dropdown") as? HTMLSelectElement
    selectS = card.querySelector("#select-season-dropdown") as? HTMLSelectElement
    fetchBtn = card.querySelector("#load-season-btn") as? HTMLButtonElement

    populateSeasonsDropdown()

    if (selectedSeasonId == null) {
        container.div(classes = "card") {
            style = "text-align: center; padding: 3rem;"
            p {
                +"Please select a league and season above, then click Load Season."
                style = "color: var(--text-secondary);"
            }
        }
        return
    }

    // Dashboard Content
    launch {
        val dash = api.getSeasonDashboard(selectedSeasonId!!)

        container.div(classes = "dashboard-grid") {
            // Left Column: Standings
            div(classes = "card") {
                h2 { +"League Standings" }

                div(classes = "table-container") {
                    table {
                        thead {
                            tr {
                                th { +"Team" }
                                th { +"GP" }
                                th { +"W" }
                                th { +"L" }
                                th { +"PCT" }
                                th { +"RS" }
                                th { +"RA" }
                            }
                        }
                        tbody {
                            dash.standings.forEach { row ->
                                tr {
                                    td {
                                        +row.teamName
                                        style = "font-weight: bold;"
                                    }
                                    td { +row.gamesPlayed.toString() }
                                    td { +row.wins.toString() }
                                    td { +row.losses.toString() }
                                    td {
                                        +if (row.winPercentage.toString().startsWith("0.")) {
                                            row.winPercentage.toString().substring(1)
                                        } else if (row.winPercentage == 1.0) {
                                            "1.000"
                                        } else {
                                            ".000"
                                        }
                                    }
                                    td { +row.runsScored.toString() }
                                    td { +row.runsAllowed.toString() }
                                }
                            }
                        }
                    }
                }
            }

            // Right Column: Games
            div {
                div(classes = "card") {
                    style = "margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;"
                    h3 { +"Schedule Manager" }

                    button(classes = if (dash.games.isNotEmpty()) "btn btn-secondary" else "btn") {
                        +"Generate Round-Robin Schedule"
                        if (dash.games.isNotEmpty()) {
                            disabled = true
                            style = "opacity: 0.5; cursor: not-allowed;"
                        } else {
                            onClickFunction = {
                                launch {
                                    api.generateSchedule(selectedSeasonId!!)
                                    renderCurrentTab()
                                }
                            }
                        }
                    }
                }

                div(classes = "card") {
                    h2 { +"Games Schedule" }

                    div(classes = "game-list") {
                        if (dash.games.isEmpty()) {
                            p {
                                +"No games scheduled yet. Generate a schedule above!"
                                style = "color: var(--text-secondary);"
                            }
                        } else {
                            dash.games.forEach { game ->
                                div(classes = "game-card") {
                                    onClickFunction = {
                                        selectedGameId = game.id
                                        if (game.status == GameStatus.COMPLETED) {
                                            currentTab = BaseballConstants.TAB_BOXSCORE
                                        } else {
                                            currentTab = BaseballConstants.TAB_LIVE_SCORER
                                        }
                                        updateActiveTabButtons()
                                        renderCurrentTab()
                                    }

                                    div(classes = "game-team-score") {
                                        div(classes = "game-team-row") {
                                            span(classes = "team-name-tag") { +game.awayTeam.name }
                                            span(classes = "score-num") { +game.awayScore.toString() }
                                        }
                                        div(classes = "game-team-row") {
                                            span(classes = "team-name-tag") { +game.homeTeam.name }
                                            span(classes = "score-num") { +game.homeScore.toString() }
                                        }
                                    }

                                    div(classes = "game-meta") {
                                        val badgeClass = when (game.status) {
                                            GameStatus.SCHEDULED -> "badge badge-scheduled"
                                            GameStatus.IN_PROGRESS -> "badge badge-live"
                                            GameStatus.COMPLETED -> "badge badge-completed"
                                        }
                                        span(classes = badgeClass) { +game.status.name }
                                        span {
                                            +game.date
                                            style = "font-size: 0.85rem; color: var(--text-secondary);"
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
}
