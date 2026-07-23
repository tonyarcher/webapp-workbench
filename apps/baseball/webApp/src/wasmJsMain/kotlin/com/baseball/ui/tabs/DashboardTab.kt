
package com.baseball.ui.tabs


import com.baseball.BaseballConstants
import com.baseball.api
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.SeasonDashboard
import com.baseball.models.TeamStandings
import com.baseball.ui.*
import kotlinx.browser.document
import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.dom.append
import kotlinx.html.js.onChangeFunction
import kotlinx.html.js.onClickFunction
import kotlinx.html.js.option
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLInputElement
import org.w3c.dom.HTMLSelectElement

@Suppress("LongMethod", "MaxLineLength", "MagicNumber", "TooManyFunctions")
internal fun renderSeasonDashboardTab(container: HTMLElement) {
    showDashboardLoading(container)

    launch {
        try {
            ensureDashboardDataLoaded()
            container.innerHTML = ""
            container.h1 { +"Season Dashboard" }

            renderSeasonSelectorCard(container)

            if (selectedSeasonId == null) {
                showNoSeasonSelectedMessage(container)
                return@launch
            }

            val dash = api.getSeasonDashboard(selectedSeasonId!!)
            renderDashboardContent(container, dash)
        } catch (e: Throwable) {
            renderDashboardError(container, e)
        }
    }
}

private fun showDashboardLoading(container: HTMLElement) {
    container.innerHTML = ""
    container.div(classes = "card") {
        css {
            textAlign = TextAlign.center
            padding = UiConstants.CARD_PADDING_LARGE
        }
        p { +"Loading season dashboard..." }
    }
}

private suspend fun ensureDashboardDataLoaded() {
    if (leaguesList.isEmpty()) {
        leaguesList = api.getLeagues()
    }
    if (selectedLeagueId == null && leaguesList.isNotEmpty()) {
        selectedLeagueId = leaguesList.first().id
    }
    val isSeasonListInvalid = seasonsList.isEmpty() || seasonsList.firstOrNull()?.leagueId != selectedLeagueId
    if (selectedLeagueId != null && isSeasonListInvalid) {
        seasonsList = api.getSeasons(selectedLeagueId!!)
    }
    if (selectedSeasonId == null || seasonsList.none { it.id == selectedSeasonId }) {
        selectedSeasonId = seasonsList.firstOrNull()?.id
    }
}

private class SeasonSelectorControls(
    val selectSeasonEl: HTMLSelectElement?
)

private fun renderSeasonSelectorCard(container: HTMLElement): SeasonSelectorControls {
    var selectS: HTMLSelectElement? = null

    val card = container.div(classes = "card") {
        css {
            marginBottom = UiConstants.CARD_MARGIN_BOTTOM
            display = Display.flex
            gap = UiConstants.CARD_GAP_LARGE
            alignItems = Align.flexEnd
        }

        renderLeagueDropdownField()

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

    selectS = card.querySelector("#select-season-dropdown") as? HTMLSelectElement
    populateSeasonsDropdown(selectS)

    return SeasonSelectorControls(selectS)
}

private fun DIV.renderLeagueDropdownField() {
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
}

private fun populateSeasonsDropdown(selectEl: HTMLSelectElement?) {
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

private fun showNoSeasonSelectedMessage(container: HTMLElement) {
    container.div(classes = "card") {
        css {
            textAlign = TextAlign.center
            padding = Padding(3.rem)
        }
        p {
            +"Please select a league and season above, then click Load Season."
            css { color = Color("var(--text-secondary)") }
        }
    }
}

private fun renderDashboardContent(container: HTMLElement, dash: SeasonDashboard) {
    container.div(classes = "dashboard-grid") {
        renderStandingsCard(dash.standings)
        div {
            renderScheduleManagerCard(dash.games)
            renderGamesListCard(dash.games)
        }
    }
}

private fun DIV.renderStandingsCard(standings: List<TeamStandings>) {
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
                    standings.forEach { row -> renderTeamStandings(row) }
                }
            }
        }
    }
}

private fun TBODY.renderTeamStandings(row: TeamStandings) {
    tr {
        td {
            +row.teamName
            css { fontWeight = FontWeight.bold }
        }
        td { +row.gamesPlayed.toString() }
        td { +row.wins.toString() }
        td { +row.losses.toString() }
        td { +formatWinPercentage(row.winPercentage) }
        td { +row.runsScored.toString() }
        td { +row.runsAllowed.toString() }
    }
}

private fun formatWinPercentage(pct: Double): String {
    val str = pct.toString()
    return if (str.startsWith("0.")) {
        str.substring(1)
    } else if (pct == 1.0) {
        "1.000"
    } else {
        ".000"
    }
}

private fun DIV.renderScheduleManagerCard(games: List<Game>) {
    div(classes = "card") {
        css { marginBottom = UiConstants.CARD_GAP_LARGE }
        h3 { +"Schedule Manager" }
        renderRoundRobinSection(games.isNotEmpty())
        hr {
            css {
                border = Border(1.px, BorderStyle.solid, Color("rgba(255,255,255,0.05)"))
                margin = Margin(UiConstants.CARD_GAP, 0.px)
            }
        }
        h4 { +"Schedule a Single Game" }
        renderSingleGameScheduleForm()
    }
}

@Suppress("MagicNumber")
private fun DIV.renderRoundRobinSection(hasGames: Boolean) {
    div {
        css {
            display = Display.flex
            justifyContent = JustifyContent.spaceBetween
            alignItems = Align.center
            marginBottom = UiConstants.CARD_GAP
        }
        span { +"Generate a full round-robin season schedule automatically:" }
        button(classes = if (hasGames) "btn btn-secondary" else "btn") {
            +"Generate Round-Robin Schedule"
            if (hasGames) {
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
}

private fun DIV.renderSingleGameScheduleForm() {
    div {
        css {
            display = Display.flex
            flexWrap = FlexWrap.wrap
            gap = UiConstants.CARD_GAP
            alignItems = Align.flexEnd
        }
        renderTeamSelectGroup("Home Team", "sched-home-select", defaultIndex = 0)
        renderTeamSelectGroup("Away Team", "sched-away-select", defaultIndex = 1)
        renderDateInputGroup()
        button(classes = "btn") {
            +"Schedule"
            onClickFunction = { handleScheduleSingleGameSubmit() }
        }
    }
}

private fun DIV.renderTeamSelectGroup(labelText: String, selectId: String, defaultIndex: Int) {
    div(classes = "form-group") {
        css {
            marginBottom = 0.px
            put("flex", "1 1 200px")
        }
        label { +labelText }
        select(classes = "form-control") {
            id = selectId
            teamsList.forEachIndexed { index, t ->
                option {
                    value = t.id.toString()
                    selected = (index == defaultIndex) || (teamsList.size <= defaultIndex && index == 0)
                    +"${t.city} ${t.name}"
                }
            }
        }
    }
}

private fun DIV.renderDateInputGroup() {
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
}

private fun handleScheduleSingleGameSubmit() {
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

private fun DIV.renderGamesListCard(games: List<Game>) {
    div(classes = "card") {
        h3 { +"Games & Schedule" }
        if (games.isEmpty()) {
            p {
                +"No games scheduled yet."
                css { color = Color("var(--text-secondary)") }
            }
        } else {
            div(classes = "games-list") {
                css {
                    maxHeight = 400.px
                    overflowY = Overflow.auto
                }
                games.forEach { g -> renderGameCardItem(g) }
            }
        }
    }
}

private fun DIV.renderGameCardItem(g: Game) {
    div(classes = "game-card") {
        css {
            display = Display.flex
            justifyContent = JustifyContent.spaceBetween
            alignItems = Align.center
            padding = UiConstants.CARD_PADDING
            marginBottom = UiConstants.CARD_GAP_SMALL
        }
        div {
            div {
                css { fontWeight = FontWeight.bold }
                +"${g.awayTeam.city} ${g.awayTeam.name} @ ${g.homeTeam.city} ${g.homeTeam.name}"
            }
            div {
                css {
                    fontSize = UiConstants.FONT_SIZE_MEDIUM
                    color = Color("var(--text-secondary)")
                    marginTop = UiConstants.CARD_GAP_SMALL
                }
                +"Date: ${g.date} | Status: ${g.status}"
            }
        }
        renderGameCardAction(g)
    }
}

private fun DIV.renderGameCardAction(g: Game) {
    div {
        css {
            display = Display.flex
            gap = UiConstants.CARD_GAP_SMALL
            alignItems = Align.center
        }
        if (g.status == GameStatus.COMPLETED) {
            span {
                css {
                    fontWeight = FontWeight.bold
                    marginRight = UiConstants.CARD_GAP
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

private fun renderDashboardError(container: HTMLElement, e: Throwable) {
    container.innerHTML = ""
    container.div(classes = "card") {
        css {
            textAlign = TextAlign.center
            padding = UiConstants.CARD_PADDING_LARGE
        }
        h2 { +"Failed to load Dashboard" }
        p {
            css { color = Color("var(--text-secondary)") }
            +"Error: ${e.message}"
        }
        button(classes = "btn btn-primary") {
            +"Retry"
            css { marginTop = UiConstants.CARD_GAP }
            onClickFunction = {
                renderCurrentTab()
            }
        }
    }
}
