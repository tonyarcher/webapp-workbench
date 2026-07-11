package com.baseball.ui

import com.baseball.UiConstants

import com.baseball.api
import com.baseball.models.*
import org.w3c.dom.*
import kotlinx.browser.document

// TEAMS AND ROSTERS TAB
internal fun renderTeamsTab(container: HTMLElement) {
    container.appendElement(UiConstants.Html.H1) { textContent = "Teams & Rosters" }
    
    val grid = container.appendElement(UiConstants.Html.DIV, "dashboard-grid")
    
    // Left Column: List of Teams
    val leftCol = grid.appendElement(UiConstants.Html.DIV, "card")
    leftCol.appendElement(UiConstants.Html.H2) { textContent = "Teams" }
    val teamsListDiv = leftCol.appendElement(UiConstants.Html.DIV)
    
    fun refreshTeamsUI() {
        teamsListDiv.innerHTML = ""
        if (teamsList.isEmpty()) {
            teamsListDiv.appendElement(UiConstants.Html.P) {
                textContent = "No teams created yet."
                style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
            }
        } else {
            teamsList.forEach { team ->
                teamsListDiv.appendElement(UiConstants.Html.DIV, "game-card") {
                    style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.75rem")
                    style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                    style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
                    style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
                    
                    appendElement(UiConstants.Html.DIV) {
                        appendElement(UiConstants.Html.DIV) {
                            style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                            textContent = "${team.city} ${team.name}"
                        }
                        appendElement(UiConstants.Html.DIV) {
                            style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
                            style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
                            textContent = team.abbreviation
                        }
                    }
                    
                    appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
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
    val rightCol = grid.appendElement(UiConstants.Html.DIV)
    
    // Create Team Form
    val createTeamCard = rightCol.appendElement(UiConstants.Html.DIV, "card") {
        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "2rem")
    }
    createTeamCard.appendElement(UiConstants.Html.H2) { textContent = "Add Team" }
    val tForm = createTeamCard.appendElement(UiConstants.Html.FORM)
    
    val tfg1 = tForm.appendElement(UiConstants.Html.DIV, "form-group")
    tfg1.appendElement(UiConstants.Html.LABEL) { textContent = "City" }
    val inputCity = tfg1.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
    inputCity.placeholder = "e.g., Boston"
    
    val tfg2 = tForm.appendElement(UiConstants.Html.DIV, "form-group")
    tfg2.appendElement(UiConstants.Html.LABEL) { textContent = "Team Name" }
    val inputTName = tfg2.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
    inputTName.placeholder = "e.g., Red Sox"
 
    val tfg3 = tForm.appendElement(UiConstants.Html.DIV, "form-group")
    tfg3.appendElement(UiConstants.Html.LABEL) { textContent = "Abbreviation" }
    val inputAbb = tfg3.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
    inputAbb.placeholder = "e.g., BOS"
    
    val tSubmit = tForm.appendElement(UiConstants.Html.BUTTON, "btn") as HTMLButtonElement
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
        val rosterCard = rightCol.appendElement(UiConstants.Html.DIV, "card")
        val team = teamsList.find { it.id == selectedTeamId }
        rosterCard.appendElement(UiConstants.Html.H2) { textContent = "${team?.city} ${team?.name} Roster" }
        
        val rosterDiv = rosterCard.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
        }
        
        fun refreshRoster() {
            launch {
                val roster = api.getTeamRoster(selectedTeamId!!)
                rosterDiv.innerHTML = ""
                if (roster.isEmpty()) {
                    rosterDiv.appendElement(UiConstants.Html.P) {
                        textContent = "No players on this roster."
                        style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
                    }
                } else {
                    val tableContainer = rosterDiv.appendElement(UiConstants.Html.DIV, "table-container")
                    val table = tableContainer.appendElement(UiConstants.Html.TABLE)
                    val thead = table.appendElement(UiConstants.Html.THEAD)
                    val trh = thead.appendElement(UiConstants.Html.TR)
                    trh.appendElement(UiConstants.Html.TH) { textContent = "#" }
                    trh.appendElement(UiConstants.Html.TH) { textContent = "Name" }
                    trh.appendElement(UiConstants.Html.TH) { textContent = "Pos" }
                    trh.appendElement(UiConstants.Html.TH) { textContent = "B/T" }
                    
                    val tbody = table.appendElement(UiConstants.Html.TBODY)
                    roster.forEach { p ->
                        val trd = tbody.appendElement(UiConstants.Html.TR)
                        trd.appendElement(UiConstants.Html.TD) { textContent = p.jerseyNumber.toString(); style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD) }
                        trd.appendElement(UiConstants.Html.TD) { textContent = p.name }
                        trd.appendElement(UiConstants.Html.TD) { textContent = p.position; style.setProperty(UiConstants.Css.COLOR, "var(--accent-green)") }
                        trd.appendElement(UiConstants.Html.TD) { textContent = "${p.battingHand}/${p.throwingHand}" }
                    }
                }
            }
        }
        
        refreshRoster()

        // Add Player Form
        rosterCard.appendElement(UiConstants.Html.H3) { textContent = "Add Player to Roster" }
        val pForm = rosterCard.appendElement(UiConstants.Html.FORM)
        
        val pfg1 = pForm.appendElement(UiConstants.Html.DIV, "form-group")
        pfg1.appendElement(UiConstants.Html.LABEL) { textContent = "Player Name" }
        val inputPName = pfg1.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
        inputPName.placeholder = "e.g., Dustin Pedroia"
        
        val pfg2 = pForm.appendElement(UiConstants.Html.DIV, "form-group")
        pfg2.appendElement(UiConstants.Html.LABEL) { textContent = "Position" }
        val inputPos = pfg2.appendElement(UiConstants.Html.SELECT, "form-control") as HTMLSelectElement
        listOf("P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH").forEach { pos ->
            val opt = document.createElement(UiConstants.Html.OPTION) as HTMLOptionElement
            opt.value = pos
            opt.textContent = pos
            inputPos.appendChild(opt)
        }

        val pfg3 = pForm.appendElement(UiConstants.Html.DIV, "form-group")
        pfg3.appendElement(UiConstants.Html.LABEL) { textContent = "Jersey Number" }
        val inputNum = pfg3.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
        inputNum.type = "number"
        inputNum.value = "15"

        val pfg4 = pForm.appendElement(UiConstants.Html.DIV, "form-group")
        pfg4.appendElement(UiConstants.Html.LABEL) { textContent = "Batting / Throwing Hand" }
        val pfg4Row = pfg4.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.GAP, "1rem")
        }
        val selectBat = pfg4Row.appendElement(UiConstants.Html.SELECT, "form-control") as HTMLSelectElement
        listOf("R", "L", "S").forEach { h ->
            val opt = document.createElement(UiConstants.Html.OPTION) as HTMLOptionElement
            opt.value = h
            opt.textContent = "Bat: $h"
            selectBat.appendChild(opt)
        }
        val selectThrow = pfg4Row.appendElement(UiConstants.Html.SELECT, "form-control") as HTMLSelectElement
        listOf("R", "L").forEach { h ->
            val opt = document.createElement(UiConstants.Html.OPTION) as HTMLOptionElement
            opt.value = h
            opt.textContent = "Throw: $h"
            selectThrow.appendChild(opt)
        }
        
        val pSubmit = pForm.appendElement(UiConstants.Html.BUTTON, "btn") as HTMLButtonElement
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
