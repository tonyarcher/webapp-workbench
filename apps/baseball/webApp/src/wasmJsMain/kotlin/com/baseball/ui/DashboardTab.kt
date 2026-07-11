package com.baseball.ui

import com.baseball.BaseballConstants

import com.baseball.UiConstants

import com.baseball.api
import com.baseball.models.*
import org.w3c.dom.*
import kotlinx.browser.document

// SEASON DASHBOARD TAB
internal fun renderSeasonDashboardTab(container: HTMLElement) {
    container.appendElement(UiConstants.Html.H1) { textContent = "Season Dashboard" }

    // Dropdown selectors for League & Season
    val selectorCard = container.appendElement(UiConstants.Html.DIV, "card") {
        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "2rem")
        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
        style.setProperty(UiConstants.Css.GAP, "1.5rem")
        style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.FLEX_END)
    }

    val lg1 = selectorCard.appendElement(UiConstants.Html.DIV, "form-group") { style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0"); style.setProperty(UiConstants.Css.FLEX, "1") }
    lg1.appendElement(UiConstants.Html.LABEL) { textContent = "Active League" }
    val selectL = lg1.appendElement(UiConstants.Html.SELECT, "form-control") as HTMLSelectElement
    leaguesList.forEach { league ->
        val opt = document.createElement(UiConstants.Html.OPTION) as HTMLOptionElement
        opt.value = league.id.toString()
        opt.textContent = league.name
        if (selectedLeagueId == league.id) opt.selected = true
        selectL.appendChild(opt)
    }

    val lg2 = selectorCard.appendElement(UiConstants.Html.DIV, "form-group") { style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0"); style.setProperty(UiConstants.Css.FLEX, "1") }
    lg2.appendElement(UiConstants.Html.LABEL) { textContent = "Active Season" }
    val selectS = lg2.appendElement(UiConstants.Html.SELECT, "form-control") as HTMLSelectElement
    
    fun populateSeasonsDropdown() {
        selectS.innerHTML = ""
        seasonsList.forEach { season ->
            val opt = document.createElement(UiConstants.Html.OPTION) as HTMLOptionElement
            opt.value = season.id.toString()
            opt.textContent = "${season.name} (${season.year})"
            if (selectedSeasonId == season.id) opt.selected = true
            selectS.appendChild(opt)
        }
    }
    populateSeasonsDropdown()

    val fetchBtn = selectorCard.appendElement(UiConstants.Html.BUTTON, "btn") { textContent = "Load Season" }

    selectL.addEventListener("change", {
        val lid = selectL.value.toLongOrNull()
        if (lid != null) {
            selectedLeagueId = lid
            launch {
                seasonsList = api.getSeasons(lid)
                selectedSeasonId = seasonsList.firstOrNull()?.id
                populateSeasonsDropdown()
            }
        }
    })

    fetchBtn.onClick {
        selectedSeasonId = selectS.value.toLongOrNull()
        renderCurrentTab()
    }

    if (selectedSeasonId == null) {
        container.appendElement(UiConstants.Html.DIV, "card") {
            style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
            style.setProperty(UiConstants.Css.PADDING, "3rem")
            appendElement(UiConstants.Html.P) {
                textContent = "Please select a league and season above, then click Load Season."
                style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
            }
        }
        return
    }

    // Dashboard Content
    launch {
        val dash = api.getSeasonDashboard(selectedSeasonId!!)
        
        val grid = container.appendElement(UiConstants.Html.DIV, "dashboard-grid")
        
        // Left Column: Standings
        val leftCol = grid.appendElement(UiConstants.Html.DIV, "card")
        leftCol.appendElement(UiConstants.Html.H2) { textContent = "League Standings" }
        
        val tableContainer = leftCol.appendElement(UiConstants.Html.DIV, "table-container")
        val table = tableContainer.appendElement(UiConstants.Html.TABLE)
        val thead = table.appendElement(UiConstants.Html.THEAD)
        val trh = thead.appendElement(UiConstants.Html.TR)
        trh.appendElement(UiConstants.Html.TH) { textContent = "Team" }
        trh.appendElement(UiConstants.Html.TH) { textContent = "GP" }
        trh.appendElement(UiConstants.Html.TH) { textContent = "W" }
        trh.appendElement(UiConstants.Html.TH) { textContent = "L" }
        trh.appendElement(UiConstants.Html.TH) { textContent = "PCT" }
        trh.appendElement(UiConstants.Html.TH) { textContent = "RS" }
        trh.appendElement(UiConstants.Html.TH) { textContent = "RA" }

        val tbody = table.appendElement(UiConstants.Html.TBODY)
        dash.standings.forEach { row ->
            val trd = tbody.appendElement(UiConstants.Html.TR)
            trd.appendElement(UiConstants.Html.TD) { textContent = row.teamName; style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD) }
            trd.appendElement(UiConstants.Html.TD) { textContent = row.gamesPlayed.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = row.wins.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = row.losses.toString() }
            trd.appendElement(UiConstants.Html.TD) { 
                textContent = if (row.winPercentage.toString().startsWith("0.")) {
                    row.winPercentage.toString().substring(1)
                } else if (row.winPercentage == 1.0) {
                    "1.000"
                } else {
                    ".000"
                }
            }
            trd.appendElement(UiConstants.Html.TD) { textContent = row.runsScored.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = row.runsAllowed.toString() }
        }

        // Right Column: Games
        val rightCol = grid.appendElement(UiConstants.Html.DIV)
        
        val actionsCard = rightCol.appendElement(UiConstants.Html.DIV, "card") {
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
            style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
        }
        actionsCard.appendElement(UiConstants.Html.H3) { textContent = "Schedule Manager" }
        
        val generateBtn = actionsCard.appendElement(UiConstants.Html.BUTTON, "btn") {
            textContent = "Generate Round-Robin Schedule"
        }
        if (dash.games.isNotEmpty()) {
            generateBtn.setAttribute("disabled", "true")
            generateBtn.className = "btn btn-secondary"
            generateBtn.style.setProperty(UiConstants.Css.OPACITY, "0.5")
            generateBtn.style.setProperty(UiConstants.Css.CURSOR, "not-allowed")
        } else {
            generateBtn.onClick {
                launch {
                    api.generateSchedule(selectedSeasonId!!)
                    renderCurrentTab()
                }
            }
        }

        val gamesCard = rightCol.appendElement(UiConstants.Html.DIV, "card")
        gamesCard.appendElement(UiConstants.Html.H2) { textContent = "Games Schedule" }
        
        val gamesListDiv = gamesCard.appendElement(UiConstants.Html.DIV, "game-list")
        if (dash.games.isEmpty()) {
            gamesListDiv.appendElement(UiConstants.Html.P) {
                textContent = "No games scheduled yet. Generate a schedule above!"
                style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
            }
        } else {
            dash.games.forEach { game ->
                gamesListDiv.appendElement(UiConstants.Html.DIV, "game-card") {
                    onClick {
                        selectedGameId = game.id
                        if (game.status == GameStatus.COMPLETED) {
                            currentTab = BaseballConstants.TAB_BOXSCORE
                        } else {
                            currentTab = BaseballConstants.TAB_LIVE_SCORER
                        }
                        updateActiveTabButtons()
                        renderCurrentTab()
                    }
                    
                    val teamScore = appendElement(UiConstants.Html.DIV, "game-team-score")
                    val awayRow = teamScore.appendElement(UiConstants.Html.DIV, "game-team-row")
                    awayRow.appendElement(UiConstants.Html.SPAN, "team-name-tag") { textContent = game.awayTeam.name }
                    awayRow.appendElement(UiConstants.Html.SPAN, "score-num") { textContent = game.awayScore.toString() }
                    
                    val homeRow = teamScore.appendElement(UiConstants.Html.DIV, "game-team-row")
                    homeRow.appendElement(UiConstants.Html.SPAN, "team-name-tag") { textContent = game.homeTeam.name }
                    homeRow.appendElement(UiConstants.Html.SPAN, "score-num") { textContent = game.homeScore.toString() }
                    
                    val meta = appendElement(UiConstants.Html.DIV, "game-meta")
                    val badgeClass = when (game.status) {
                        GameStatus.SCHEDULED -> "badge badge-scheduled"
                        GameStatus.IN_PROGRESS -> "badge badge-live"
                        GameStatus.COMPLETED -> "badge badge-completed"
                    }
                    meta.appendElement(UiConstants.Html.SPAN, badgeClass) { textContent = game.status.name }
                    meta.appendElement(UiConstants.Html.SPAN) {
                        textContent = game.date
                        style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
                        style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
                    }
                }
            }
        }
    }
}
