package com.baseball.ui.tabs

import com.baseball.BaseballConstants
import com.baseball.UiConstants
import com.baseball.api
import com.baseball.models.*
import org.w3c.dom.*
import kotlinx.browser.document
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.dom.*
import kotlinx.css.*
import com.baseball.ui.*

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
        css {
            marginBottom = 2.rem
            display = Display.flex
            gap = 1.5.rem
            alignItems = Align.flexEnd
        }

        div(classes = "form-group") {
            css {
                marginBottom = 0.px
                flexGrow = 1.0
            }
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
            css {
                marginBottom = 0.px
                flexGrow = 1.0
            }
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
            css {
                textAlign = TextAlign.center
                padding = Padding(3.rem)
            }
            p {
                +"Please select a league and season above, then click Load Season."
                css {
                    color = Color("var(--text-secondary)")
                }
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
                                        css {
                                            fontWeight = FontWeight.bold
                                        }
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
                    css {
                        marginBottom = 1.5.rem
                        display = Display.flex
                        justifyContent = JustifyContent.spaceBetween
                        alignItems = Align.center
                    }
                    h3 { +"Schedule Manager" }

                    button(classes = if (dash.games.isNotEmpty()) "btn btn-secondary" else "btn") {
                        +"Generate Round-Robin Schedule"
                        if (dash.games.isNotEmpty()) {
                            disabled = true
                            css {
                                opacity = 0.5
                                cursor = Cursor.notAllowed
                            }
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
                                css {
                                    color = Color("var(--text-secondary)")
                                }
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
                                            css {
                                                fontSize = 0.85.rem
                                                color = Color("var(--text-secondary)")
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
}
