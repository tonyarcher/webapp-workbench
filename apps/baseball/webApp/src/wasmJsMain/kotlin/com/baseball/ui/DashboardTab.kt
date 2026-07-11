package com.baseball.ui

import com.baseball.api
import com.baseball.models.*
import com.baseball.Constants
import org.w3c.dom.*
import kotlinx.browser.document

// SEASON DASHBOARD TAB
internal fun renderSeasonDashboardTab(container: HTMLElement) {
    container.appendElement(Constants.Html.H1) { textContent = "Season Dashboard" }

    // Dropdown selectors for League & Season
    val selectorCard = container.appendElement(Constants.Html.DIV, "card") {
        style.setProperty(Constants.Css.MARGIN_BOTTOM, "2rem")
        style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.FLEX)
        style.setProperty(Constants.Css.GAP, "1.5rem")
        style.setProperty(Constants.Css.ALIGN_ITEMS, Constants.CssValues.FLEX_END)
    }

    val lg1 = selectorCard.appendElement(Constants.Html.DIV, "form-group") { style.setProperty(Constants.Css.MARGIN_BOTTOM, "0"); style.setProperty(Constants.Css.FLEX, "1") }
    lg1.appendElement(Constants.Html.LABEL) { textContent = "Active League" }
    val selectL = lg1.appendElement(Constants.Html.SELECT, "form-control") as HTMLSelectElement
    leaguesList.forEach { league ->
        val opt = document.createElement(Constants.Html.OPTION) as HTMLOptionElement
        opt.value = league.id.toString()
        opt.textContent = league.name
        if (selectedLeagueId == league.id) opt.selected = true
        selectL.appendChild(opt)
    }

    val lg2 = selectorCard.appendElement(Constants.Html.DIV, "form-group") { style.setProperty(Constants.Css.MARGIN_BOTTOM, "0"); style.setProperty(Constants.Css.FLEX, "1") }
    lg2.appendElement(Constants.Html.LABEL) { textContent = "Active Season" }
    val selectS = lg2.appendElement(Constants.Html.SELECT, "form-control") as HTMLSelectElement
    
    fun populateSeasonsDropdown() {
        selectS.innerHTML = ""
        seasonsList.forEach { season ->
            val opt = document.createElement(Constants.Html.OPTION) as HTMLOptionElement
            opt.value = season.id.toString()
            opt.textContent = "${season.name} (${season.year})"
            if (selectedSeasonId == season.id) opt.selected = true
            selectS.appendChild(opt)
        }
    }
    populateSeasonsDropdown()

    val fetchBtn = selectorCard.appendElement(Constants.Html.BUTTON, "btn") { textContent = "Load Season" }

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
        container.appendElement(Constants.Html.DIV, "card") {
            style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER)
            style.setProperty(Constants.Css.PADDING, "3rem")
            appendElement(Constants.Html.P) {
                textContent = "Please select a league and season above, then click Load Season."
                style.setProperty(Constants.Css.COLOR, "var(--text-secondary)")
            }
        }
        return
    }

    // Dashboard Content
    launch {
        val dash = api.getSeasonDashboard(selectedSeasonId!!)
        
        val grid = container.appendElement(Constants.Html.DIV, "dashboard-grid")
        
        // Left Column: Standings
        val leftCol = grid.appendElement(Constants.Html.DIV, "card")
        leftCol.appendElement(Constants.Html.H2) { textContent = "League Standings" }
        
        val tableContainer = leftCol.appendElement(Constants.Html.DIV, "table-container")
        val table = tableContainer.appendElement(Constants.Html.TABLE)
        val thead = table.appendElement(Constants.Html.THEAD)
        val trh = thead.appendElement(Constants.Html.TR)
        trh.appendElement(Constants.Html.TH) { textContent = "Team" }
        trh.appendElement(Constants.Html.TH) { textContent = "GP" }
        trh.appendElement(Constants.Html.TH) { textContent = "W" }
        trh.appendElement(Constants.Html.TH) { textContent = "L" }
        trh.appendElement(Constants.Html.TH) { textContent = "PCT" }
        trh.appendElement(Constants.Html.TH) { textContent = "RS" }
        trh.appendElement(Constants.Html.TH) { textContent = "RA" }

        val tbody = table.appendElement(Constants.Html.TBODY)
        dash.standings.forEach { row ->
            val trd = tbody.appendElement(Constants.Html.TR)
            trd.appendElement(Constants.Html.TD) { textContent = row.teamName; style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD) }
            trd.appendElement(Constants.Html.TD) { textContent = row.gamesPlayed.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = row.wins.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = row.losses.toString() }
            trd.appendElement(Constants.Html.TD) { 
                textContent = if (row.winPercentage.toString().startsWith("0.")) {
                    row.winPercentage.toString().substring(1)
                } else if (row.winPercentage == 1.0) {
                    "1.000"
                } else {
                    ".000"
                }
            }
            trd.appendElement(Constants.Html.TD) { textContent = row.runsScored.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = row.runsAllowed.toString() }
        }

        // Right Column: Games
        val rightCol = grid.appendElement(Constants.Html.DIV)
        
        val actionsCard = rightCol.appendElement(Constants.Html.DIV, "card") {
            style.setProperty(Constants.Css.MARGIN_BOTTOM, "1.5rem")
            style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.FLEX)
            style.setProperty(Constants.Css.JUSTIFY_CONTENT, Constants.CssValues.SPACE_BETWEEN)
            style.setProperty(Constants.Css.ALIGN_ITEMS, Constants.CssValues.CENTER)
        }
        actionsCard.appendElement(Constants.Html.H3) { textContent = "Schedule Manager" }
        
        val generateBtn = actionsCard.appendElement(Constants.Html.BUTTON, "btn") {
            textContent = "Generate Round-Robin Schedule"
        }
        if (dash.games.isNotEmpty()) {
            generateBtn.setAttribute("disabled", "true")
            generateBtn.className = "btn btn-secondary"
            generateBtn.style.setProperty(Constants.Css.OPACITY, "0.5")
            generateBtn.style.setProperty(Constants.Css.CURSOR, "not-allowed")
        } else {
            generateBtn.onClick {
                launch {
                    api.generateSchedule(selectedSeasonId!!)
                    renderCurrentTab()
                }
            }
        }

        val gamesCard = rightCol.appendElement(Constants.Html.DIV, "card")
        gamesCard.appendElement(Constants.Html.H2) { textContent = "Games Schedule" }
        
        val gamesListDiv = gamesCard.appendElement(Constants.Html.DIV, "game-list")
        if (dash.games.isEmpty()) {
            gamesListDiv.appendElement(Constants.Html.P) {
                textContent = "No games scheduled yet. Generate a schedule above!"
                style.setProperty(Constants.Css.COLOR, "var(--text-secondary)")
            }
        } else {
            dash.games.forEach { game ->
                gamesListDiv.appendElement(Constants.Html.DIV, "game-card") {
                    onClick {
                        selectedGameId = game.id
                        if (game.status == GameStatus.COMPLETED) {
                            currentTab = Constants.TAB_BOXSCORE
                        } else {
                            currentTab = Constants.TAB_LIVE_SCORER
                        }
                        updateActiveTabButtons()
                        renderCurrentTab()
                    }
                    
                    val teamScore = appendElement(Constants.Html.DIV, "game-team-score")
                    val awayRow = teamScore.appendElement(Constants.Html.DIV, "game-team-row")
                    awayRow.appendElement(Constants.Html.SPAN, "team-name-tag") { textContent = game.awayTeam.name }
                    awayRow.appendElement(Constants.Html.SPAN, "score-num") { textContent = game.awayScore.toString() }
                    
                    val homeRow = teamScore.appendElement(Constants.Html.DIV, "game-team-row")
                    homeRow.appendElement(Constants.Html.SPAN, "team-name-tag") { textContent = game.homeTeam.name }
                    homeRow.appendElement(Constants.Html.SPAN, "score-num") { textContent = game.homeScore.toString() }
                    
                    val meta = appendElement(Constants.Html.DIV, "game-meta")
                    val badgeClass = when (game.status) {
                        GameStatus.SCHEDULED -> "badge badge-scheduled"
                        GameStatus.IN_PROGRESS -> "badge badge-live"
                        GameStatus.COMPLETED -> "badge badge-completed"
                    }
                    meta.appendElement(Constants.Html.SPAN, badgeClass) { textContent = game.status.name }
                    meta.appendElement(Constants.Html.SPAN) {
                        textContent = game.date
                        style.setProperty(Constants.Css.FONT_SIZE, "0.85rem")
                        style.setProperty(Constants.Css.COLOR, "var(--text-secondary)")
                    }
                }
            }
        }
    }
}
