package com.baseball.ui.tabs

import com.baseball.BaseballConstants
import com.baseball.api
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.ui.*

import kotlinx.browser.document
import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.dom.append
import kotlinx.html.js.onChangeFunction
import kotlinx.html.js.onClickFunction
import kotlinx.html.js.option
import org.w3c.dom.HTMLButtonElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLInputElement
import org.w3c.dom.HTMLSelectElement

internal fun renderSeasonDashboardTab(container: HTMLElement) {
    container.innerHTML = ""
    container.div(classes = "card") {
        css {
            textAlign = TextAlign.center
            padding = Padding(3.rem)
        }
        p { +"Loading season dashboard..." }
    }

    launch {
        try {
            if (leaguesList.isEmpty()) {
                leaguesList = api.getLeagues()
            }
            if (selectedLeagueId == null && leaguesList.isNotEmpty()) {
                selectedLeagueId = leaguesList.first().id
            }
            if (selectedLeagueId != null && (seasonsList.isEmpty() || seasonsList.firstOrNull()?.leagueId != selectedLeagueId)) {
                seasonsList = api.getSeasons(selectedLeagueId!!)
            }
            if (selectedSeasonId == null || seasonsList.none { it.id == selectedSeasonId }) {
                selectedSeasonId = seasonsList.firstOrNull()?.id
            }

            container.innerHTML = ""
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
                                    saveNavState()
                                    renderCurrentTab()
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
                        saveNavState()
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
                return@launch
            }

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
                        }
                        h3 { +"Schedule Manager" }
                        div {
                            css {
                                display = Display.flex
                                justifyContent = JustifyContent.spaceBetween
                                alignItems = Align.center
                                marginBottom = 1.rem
                            }
                            span { +"Generate a full round-robin season schedule automatically:" }
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

                        hr {
                            css {
                                border = Border(1.px, BorderStyle.solid, Color("rgba(255,255,255,0.05)"))
                                margin = Margin(1.rem, 0.px)
                            }
                        }

                        h4 { +"Schedule a Single Game" }
                        div {
                            css {
                                display = Display.flex
                                flexWrap = FlexWrap.wrap
                                gap = 1.rem
                                alignItems = Align.flexEnd
                            }
                            div(classes = "form-group") {
                                css {
                                    marginBottom = 0.px
                                    put("flex", "1 1 200px")
                                }
                                label { +"Home Team" }
                                select(classes = "form-control") {
                                    id = "sched-home-select"
                                    teamsList.forEachIndexed { index, t ->
                                        option {
                                            value = t.id.toString()
                                            selected = (index == 0)
                                            +"${t.city} ${t.name}"
                                        }
                                    }
                                }
                            }
                            div(classes = "form-group") {
                                css {
                                    marginBottom = 0.px
                                    put("flex", "1 1 200px")
                                }
                                label { +"Away Team" }
                                select(classes = "form-control") {
                                    id = "sched-away-select"
                                    teamsList.forEachIndexed { index, t ->
                                        option {
                                            value = t.id.toString()
                                            selected = (teamsList.size > 1 && index == 1) || (teamsList.size <= 1 && index == 0)
                                            +"${t.city} ${t.name}"
                                        }
                                    }
                                }
                            }
                            div(classes = "form-group") {
                                css {
                                    marginBottom = 0.px
                                    put("flex", "1 1 150px")
                                }
                                label { +"Date" }
                                input(type = InputType.text, classes = "form-control") {
                                    id = "sched-date-input"
                                    value = "2026-07-10"
                                }
                            }
                            button(classes = "btn") {
                                +"Schedule"
                                onClickFunction = {
                                    val homeSel = document.getElementById("sched-home-select") as? HTMLSelectElement
                                    val awaySel = document.getElementById("sched-away-select") as? HTMLSelectElement
                                    val dateInp = document.getElementById("sched-date-input") as? HTMLInputElement
                                    val homeId = homeSel?.value?.toLongOrNull()
                                    val awayId = awaySel?.value?.toLongOrNull()
                                    val dateVal = dateInp?.value

                                    if (homeId != null && awayId != null && !dateVal.isNullOrEmpty()) {
                                        launch {
                                            val hTeam = teamsList.find { it.id == homeId }
                                            val aTeam = teamsList.find { it.id == awayId }
                                            if (hTeam != null && aTeam != null) {
                                                val newGame = Game(
                                                    id = null,
                                                    seasonId = selectedSeasonId!!,
                                                    homeTeam = hTeam,
                                                    awayTeam = aTeam,
                                                    date = dateVal,
                                                    status = GameStatus.SCHEDULED,
                                                )
                                                api.createGame(newGame)
                                                renderCurrentTab()
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    div(classes = "card") {
                        h3 { +"Games & Schedule" }
                        if (dash.games.isEmpty()) {
                            p {
                                +"No games scheduled yet."
                                css {
                                    color = Color("var(--text-secondary)")
                                }
                            }
                        } else {
                            div(classes = "games-list") {
                                css {
                                    maxHeight = 400.px
                                    overflowY = Overflow.auto
                                }
                                dash.games.forEach { g ->
                                    div(classes = "game-card") {
                                        css {
                                            display = Display.flex
                                            justifyContent = JustifyContent.spaceBetween
                                            alignItems = Align.center
                                            padding = Padding(0.75.rem)
                                            marginBottom = 0.5.rem
                                        }
                                        div {
                                            div {
                                                css { fontWeight = FontWeight.bold }
                                                +"${g.awayTeam.city} ${g.awayTeam.name} @ ${g.homeTeam.city} ${g.homeTeam.name}"
                                            }
                                            div {
                                                css {
                                                    fontSize = 0.85.rem
                                                    color = Color("var(--text-secondary)")
                                                    marginTop = 0.25.rem
                                                }
                                                +"Date: ${g.date} | Status: ${g.status}"
                                            }
                                        }
                                        div {
                                            css {
                                                display = Display.flex
                                                gap = 0.5.rem
                                                alignItems = Align.center
                                            }
                                            if (g.status == GameStatus.COMPLETED) {
                                                span {
                                                    css {
                                                        fontWeight = FontWeight.bold
                                                        marginRight = 1.rem
                                                    }
                                                    +"${g.awayScore} - ${g.homeScore}"
                                                }
                                                button(classes = "btn btn-secondary") {
                                                    +"Box Score"
                                                    onClickFunction = {
                                                        selectedGameId = g.id
                                                        currentTab = BaseballConstants.TAB_BOXSCORE
                                                        updateActiveTabButtons()
                                                        renderCurrentTab()
                                                    }
                                                }
                                            } else {
                                                button(classes = "btn btn-primary") {
                                                    +"Score Game"
                                                    onClickFunction = {
                                                        selectedGameId = g.id
                                                        currentTab = BaseballConstants.TAB_LIVE_SCORER
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
                    }
                }
            }
        } catch (e: Throwable) {
            container.innerHTML = ""
            container.div(classes = "card") {
                css {
                    textAlign = TextAlign.center
                    padding = Padding(3.rem)
                }
                h2 { +"Failed to load Dashboard" }
                p {
                    css { color = Color("var(--text-secondary)") }
                    +"Error: ${e.message}"
                }
                button(classes = "btn btn-primary") {
                    +"Retry"
                    css { marginTop = 1.rem }
                    onClickFunction = {
                        renderCurrentTab()
                    }
                }
            }
        }
    }
}
