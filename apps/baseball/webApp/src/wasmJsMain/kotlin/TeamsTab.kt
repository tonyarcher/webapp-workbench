package com.baseball

import com.baseball.models.*
import org.w3c.dom.*
import kotlinx.browser.document

// TEAMS AND ROSTERS TAB
internal fun renderTeamsTab(container: HTMLElement) {
    container.appendElement("h1") { textContent = "Teams & Rosters" }
    
    val grid = container.appendElement("div", "dashboard-grid")
    
    // Left Column: List of Teams
    val leftCol = grid.appendElement("div", "card")
    leftCol.appendElement("h2") { textContent = "Teams" }
    val teamsListDiv = leftCol.appendElement("div")
    
    fun refreshTeamsUI() {
        teamsListDiv.innerHTML = ""
        if (teamsList.isEmpty()) {
            teamsListDiv.appendElement("p") {
                textContent = "No teams created yet."
                style.color = "var(--text-secondary)"
            }
        } else {
            teamsList.forEach { team ->
                teamsListDiv.appendElement("div", "game-card") {
                    style.marginBottom = "0.75rem"
                    style.display = "flex"
                    style.justifyContent = "space-between"
                    style.alignItems = "center"
                    
                    val info = appendElement("div") {
                        val title = appendElement("div") {
                            style.fontWeight = "700"
                            textContent = "${team.city} ${team.name}"
                        }
                        val abb = appendElement("div") {
                            style.fontSize = "0.85rem"
                            style.color = "var(--text-secondary)"
                            textContent = team.abbreviation
                        }
                    }
                    
                    appendElement("button", "btn btn-secondary") {
                        textContent = if (selectedTeamId == team.id) "Viewing Roster" else "View Roster"
                        if (selectedTeamId == team.id) classList.add("active")
                        onClick {
                            selectedTeamId = team.id
                            refreshTeamsUI()
                            renderCurrentTab()
                        }
                    }
                }
            }
        }
    }
    refreshTeamsUI()

    // Right Column: Create Team Form / Roster View
    val rightCol = grid.appendElement("div")
    
    // Create Team Form
    val createTeamCard = rightCol.appendElement("div", "card") {
        style.marginBottom = "2rem"
    }
    createTeamCard.appendElement("h2") { textContent = "Add Team" }
    val tForm = createTeamCard.appendElement("form")
    
    val tfg1 = tForm.appendElement("div", "form-group")
    tfg1.appendElement("label") { textContent = "City" }
    val inputCity = tfg1.appendElement("input", "form-control") as HTMLInputElement
    inputCity.placeholder = "e.g., Boston"
    
    val tfg2 = tForm.appendElement("div", "form-group")
    tfg2.appendElement("label") { textContent = "Team Name" }
    val inputTName = tfg2.appendElement("input", "form-control") as HTMLInputElement
    inputTName.placeholder = "e.g., Red Sox"
 
    val tfg3 = tForm.appendElement("div", "form-group")
    tfg3.appendElement("label") { textContent = "Abbreviation" }
    val inputAbb = tfg3.appendElement("input", "form-control") as HTMLInputElement
    inputAbb.placeholder = "e.g., BOS"
    
    val tSubmit = tForm.appendElement("button", "btn") as HTMLButtonElement
    tSubmit.type = "button"
    tSubmit.textContent = "Create Team"
    tSubmit.onClick {
        val city = inputCity.value.trim()
        val name = inputTName.value.trim()
        val abb = inputAbb.value.trim()
        if (city.isNotEmpty() && name.isNotEmpty() && abb.isNotEmpty()) {
            launch {
                api.createTeam(Team(city = city, name = name, abbreviation = abb))
                teamsList = api.getTeams()
                inputCity.value = ""
                inputTName.value = ""
                inputAbb.value = ""
                refreshTeamsUI()
            }
        }
    }

    // Roster panel if team is selected
    if (selectedTeamId != null) {
        val rosterCard = rightCol.appendElement("div", "card")
        val team = teamsList.find { it.id == selectedTeamId }
        rosterCard.appendElement("h2") { textContent = "${team?.city} ${team?.name} Roster" }
        
        val rosterDiv = rosterCard.appendElement("div") {
            style.marginBottom = "1.5rem"
        }
        
        fun refreshRoster() {
            launch {
                val roster = api.getTeamRoster(selectedTeamId!!)
                rosterDiv.innerHTML = ""
                if (roster.isEmpty()) {
                    rosterDiv.appendElement("p") {
                        textContent = "No players on this roster."
                        style.color = "var(--text-secondary)"
                    }
                } else {
                    val tableContainer = rosterDiv.appendElement("div", "table-container")
                    val table = tableContainer.appendElement("table")
                    val thead = table.appendElement("thead")
                    val trh = thead.appendElement("tr")
                    trh.appendElement("th") { textContent = "#" }
                    trh.appendElement("th") { textContent = "Name" }
                    trh.appendElement("th") { textContent = "Pos" }
                    trh.appendElement("th") { textContent = "B/T" }
                    
                    val tbody = table.appendElement("tbody")
                    roster.forEach { p ->
                        val trd = tbody.appendElement("tr")
                        trd.appendElement("td") { textContent = p.jerseyNumber.toString(); style.fontWeight = "700" }
                        trd.appendElement("td") { textContent = p.name }
                        trd.appendElement("td") { textContent = p.position; style.color = "var(--accent-green)" }
                        trd.appendElement("td") { textContent = "${p.battingHand}/${p.throwingHand}" }
                    }
                }
            }
        }
        
        refreshRoster()

        // Add Player Form
        rosterCard.appendElement("h3") { textContent = "Add Player to Roster" }
        val pForm = rosterCard.appendElement("form")
        
        val pfg1 = pForm.appendElement("div", "form-group")
        pfg1.appendElement("label") { textContent = "Player Name" }
        val inputPName = pfg1.appendElement("input", "form-control") as HTMLInputElement
        inputPName.placeholder = "e.g., Dustin Pedroia"
        
        val pfg2 = pForm.appendElement("div", "form-group")
        pfg2.appendElement("label") { textContent = "Position" }
        val inputPos = pfg2.appendElement("select", "form-control") as HTMLSelectElement
        listOf("P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH").forEach { pos ->
            val opt = document.createElement("option") as HTMLOptionElement
            opt.value = pos
            opt.textContent = pos
            inputPos.appendChild(opt)
        }

        val pfg3 = pForm.appendElement("div", "form-group")
        pfg3.appendElement("label") { textContent = "Jersey Number" }
        val inputNum = pfg3.appendElement("input", "form-control") as HTMLInputElement
        inputNum.type = "number"
        inputNum.value = "15"

        val pfg4 = pForm.appendElement("div", "form-group")
        pfg4.appendElement("label") { textContent = "Batting / Throwing Hand" }
        val pfg4Row = pfg4.appendElement("div") {
            style.display = "flex"
            style.setProperty("gap", "1rem")
        }
        val selectBat = pfg4Row.appendElement("select", "form-control") as HTMLSelectElement
        listOf("R", "L", "S").forEach { h ->
            val opt = document.createElement("option") as HTMLOptionElement
            opt.value = h
            opt.textContent = "Bat: $h"
            selectBat.appendChild(opt)
        }
        val selectThrow = pfg4Row.appendElement("select", "form-control") as HTMLSelectElement
        listOf("R", "L").forEach { h ->
            val opt = document.createElement("option") as HTMLOptionElement
            opt.value = h
            opt.textContent = "Throw: $h"
            selectThrow.appendChild(opt)
        }
        
        val pSubmit = pForm.appendElement("button", "btn") as HTMLButtonElement
        pSubmit.type = "button"
        pSubmit.textContent = "Add Player"
        pSubmit.onClick {
            val name = inputPName.value.trim()
            val pos = inputPos.value
            val num = inputNum.value.toIntOrNull() ?: 0
            val bat = selectBat.value
            val thr = selectThrow.value
            if (name.isNotEmpty()) {
                launch {
                    api.createPlayer(Player(
                        teamId = selectedTeamId,
                        name = name,
                        position = pos,
                        jerseyNumber = num,
                        battingHand = bat,
                        throwingHand = thr
                    ))
                    inputPName.value = ""
                    refreshRoster()
                }
            }
        }
    }
}
