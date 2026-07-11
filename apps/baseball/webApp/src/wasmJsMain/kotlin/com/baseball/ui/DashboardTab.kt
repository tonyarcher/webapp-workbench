package com.baseball.ui

import com.baseball.api
import com.baseball.models.*
import org.w3c.dom.*
import kotlinx.browser.document

// SEASON DASHBOARD TAB
internal fun renderSeasonDashboardTab(container: HTMLElement) {
    container.appendElement("h1") { textContent = "Season Dashboard" }

    // Dropdown selectors for League & Season
    val selectorCard = container.appendElement("div", "card") {
        style.setProperty("margin-bottom", "2rem")
        style.setProperty("display", "flex")
        style.setProperty("gap", "1.5rem")
        style.setProperty("align-items", "flex-end")
    }

    val lg1 = selectorCard.appendElement("div", "form-group") { style.setProperty("margin-bottom", "0"); style.setProperty("flex", "1") }
    lg1.appendElement("label") { textContent = "Active League" }
    val selectL = lg1.appendElement("select", "form-control") as HTMLSelectElement
    leaguesList.forEach { league ->
        val opt = document.createElement("option") as HTMLOptionElement
        opt.value = league.id.toString()
        opt.textContent = league.name
        if (selectedLeagueId == league.id) opt.selected = true
        selectL.appendChild(opt)
    }

    val lg2 = selectorCard.appendElement("div", "form-group") { style.setProperty("margin-bottom", "0"); style.setProperty("flex", "1") }
    lg2.appendElement("label") { textContent = "Active Season" }
    val selectS = lg2.appendElement("select", "form-control") as HTMLSelectElement
    
    fun populateSeasonsDropdown() {
        selectS.innerHTML = ""
        seasonsList.forEach { season ->
            val opt = document.createElement("option") as HTMLOptionElement
            opt.value = season.id.toString()
            opt.textContent = "${season.name} (${season.year})"
            if (selectedSeasonId == season.id) opt.selected = true
            selectS.appendChild(opt)
        }
    }
    populateSeasonsDropdown()

    val fetchBtn = selectorCard.appendElement("button", "btn") { textContent = "Load Season" }

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
        container.appendElement("div", "card") {
            style.setProperty("text-align", "center")
            style.setProperty("padding", "3rem")
            appendElement("p") {
                textContent = "Please select a league and season above, then click Load Season."
                style.setProperty("color", "var(--text-secondary)")
            }
        }
        return
    }

    // Dashboard Content
    launch {
        val dash = api.getSeasonDashboard(selectedSeasonId!!)
        
        val grid = container.appendElement("div", "dashboard-grid")
        
        // Left Column: Standings
        val leftCol = grid.appendElement("div", "card")
        leftCol.appendElement("h2") { textContent = "League Standings" }
        
        val tableContainer = leftCol.appendElement("div", "table-container")
        val table = tableContainer.appendElement("table")
        val thead = table.appendElement("thead")
        val trh = thead.appendElement("tr")
        trh.appendElement("th") { textContent = "Team" }
        trh.appendElement("th") { textContent = "GP" }
        trh.appendElement("th") { textContent = "W" }
        trh.appendElement("th") { textContent = "L" }
        trh.appendElement("th") { textContent = "PCT" }
        trh.appendElement("th") { textContent = "RS" }
        trh.appendElement("th") { textContent = "RA" }

        val tbody = table.appendElement("tbody")
        dash.standings.forEach { row ->
            val trd = tbody.appendElement("tr")
            trd.appendElement("td") { textContent = row.teamName; style.setProperty("font-weight", "700") }
            trd.appendElement("td") { textContent = row.gamesPlayed.toString() }
            trd.appendElement("td") { textContent = row.wins.toString() }
            trd.appendElement("td") { textContent = row.losses.toString() }
            trd.appendElement("td") { 
                textContent = if (row.winPercentage.toString().startsWith("0.")) {
                    row.winPercentage.toString().substring(1)
                } else if (row.winPercentage == 1.0) {
                    "1.000"
                } else {
                    ".000"
                }
            }
            trd.appendElement("td") { textContent = row.runsScored.toString() }
            trd.appendElement("td") { textContent = row.runsAllowed.toString() }
        }

        // Right Column: Games
        val rightCol = grid.appendElement("div")
        
        val actionsCard = rightCol.appendElement("div", "card") {
            style.setProperty("margin-bottom", "1.5rem")
            style.setProperty("display", "flex")
            style.setProperty("justify-content", "space-between")
            style.setProperty("align-items", "center")
        }
        actionsCard.appendElement("h3") { textContent = "Schedule Manager" }
        
        val generateBtn = actionsCard.appendElement("button", "btn") {
            textContent = "Generate Round-Robin Schedule"
        }
        if (dash.games.isNotEmpty()) {
            generateBtn.setAttribute("disabled", "true")
            generateBtn.className = "btn btn-secondary"
            generateBtn.style.setProperty("opacity", "0.5")
            generateBtn.style.setProperty("cursor", "not-allowed")
        } else {
            generateBtn.onClick {
                launch {
                    api.generateSchedule(selectedSeasonId!!)
                    renderCurrentTab()
                }
            }
        }

        val gamesCard = rightCol.appendElement("div", "card")
        gamesCard.appendElement("h2") { textContent = "Games Schedule" }
        
        val gamesListDiv = gamesCard.appendElement("div", "game-list")
        if (dash.games.isEmpty()) {
            gamesListDiv.appendElement("p") {
                textContent = "No games scheduled yet. Generate a schedule above!"
                style.setProperty("color", "var(--text-secondary)")
            }
        } else {
            dash.games.forEach { game ->
                gamesListDiv.appendElement("div", "game-card") {
                    onClick {
                        selectedGameId = game.id
                        if (game.status == GameStatus.COMPLETED) {
                            currentTab = "boxscore"
                        } else {
                            currentTab = "live-scorer"
                        }
                        updateActiveTabButtons()
                        renderCurrentTab()
                    }
                    
                    val teamScore = appendElement("div", "game-team-score")
                    val awayRow = teamScore.appendElement("div", "game-team-row")
                    awayRow.appendElement("span", "team-name-tag") { textContent = game.awayTeam.name }
                    awayRow.appendElement("span", "score-num") { textContent = game.awayScore.toString() }
                    
                    val homeRow = teamScore.appendElement("div", "game-team-row")
                    homeRow.appendElement("span", "team-name-tag") { textContent = game.homeTeam.name }
                    homeRow.appendElement("span", "score-num") { textContent = game.homeScore.toString() }
                    
                    val meta = appendElement("div", "game-meta")
                    val badgeClass = when (game.status) {
                        GameStatus.SCHEDULED -> "badge badge-scheduled"
                        GameStatus.IN_PROGRESS -> "badge badge-live"
                        GameStatus.COMPLETED -> "badge badge-completed"
                    }
                    meta.appendElement("span", badgeClass) { textContent = game.status.name }
                    meta.appendElement("span") {
                        textContent = game.date
                        style.setProperty("font-size", "0.85rem")
                        style.setProperty("color", "var(--text-secondary)")
                    }
                }
            }
        }
    }
}
