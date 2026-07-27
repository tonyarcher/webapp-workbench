

package com.baseball.ui.tabs


import com.baseball.api
import com.baseball.models.Player
import com.baseball.models.Team
import com.baseball.ui.*
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.dom.append
import kotlinx.html.js.onClickFunction
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLInputElement
import org.w3c.dom.HTMLSelectElement
import org.w3c.dom.events.Event

private val uiScope = MainScope()

internal fun renderTeamsTab(container: HTMLElement) {
    container.append { h1 { +"Teams & Rosters" } }

    var teamsListDiv: HTMLDivElement? = null
    var rosterDiv: HTMLDivElement? = null

    fun refreshRoster() {
        val divElement = rosterDiv ?: return
        refreshRosterUI(divElement)
    }

    fun refreshTeamsUI() {
        val divElement = teamsListDiv ?: return
        refreshTeamsListUI(divElement, onSelectTeam = {
            refreshTeamsUI()
            refreshRoster()
            renderCurrentTab()
        })
    }

    // Create the dashboard grid container and obtain a reference to it
    container.append {
        div(classes = "dashboard-grid") {
            // Teams list card
            div(classes = "card") {
                h2 { +"Teams" }
                div { id = "teams-list-container" }
            }
            // Add team / roster card
            div {
                renderAddTeamCard(onTeamCreated = { refreshTeamsUI() })
                if (selectedTeamId != null) {
                    val team = teamsList.find { it.id == selectedTeamId }
                    if (team != null) {
                        renderRosterSectionCard(team, onRosterUpdated = { refreshRoster() })
                    }
                }
            }
        }
    }

    // Obtain reference to the dashboard grid container we just created
    val grid = container.querySelector(".dashboard-grid") as HTMLElement
    // Save references to sub‑containers for later UI updates
    teamsListDiv = grid.querySelector("#teams-list-container") as? HTMLDivElement
    rosterDiv = grid.querySelector("#roster-container") as? HTMLDivElement

    refreshTeamsUI()
    refreshRoster()
}

private fun refreshRosterUI(divElement: HTMLDivElement) {
    divElement.innerHTML = ""
    val tid = selectedTeamId
    if (tid == null) {
        divElement.append {
            p {
                +"Select a team to view roster."
                css { color = Color("var(--text-secondary)") }
            }
        }
        return
    }

    uiScope.launch {
        val roster = api.getTeamRoster(tid)
        renderRosterContent(divElement, roster)
    }
}

private fun renderRosterContent(divElement: HTMLDivElement, roster: List<Player>) {
    if (roster.isEmpty()) {
        divElement.append {
            p {
                +"No players on this roster yet."
                css { color = Color("var(--text-secondary)") }
            }
        }
    } else {
        divElement.append {
            div(classes = "table-container") {
                table {
                    thead {
                        tr {
                            th { +"#" }
                            th { +"Name" }
                            th { +"Position" }
                            th { +"B/T" }
                            th { +"Action" }
                        }
                    }
                    tbody {
                        roster.forEach { p ->
                            renderRosterRow(this, p, divElement)
                        }
                    }
                }
            }
        }
    }
}

private fun renderRosterRow(tbody: TBODY, p: Player, rosterDiv: HTMLDivElement) {
    tbody.tr {
        td { +p.jerseyNumber.toString() }
        td { +p.name }
        td {
            +p.position
            css { color = Color("var(--accent-green)") }
        }
        td { +"${p.battingHand}/${p.throwingHand}" }
        td {
            button(classes = "btn btn-secondary") {
                +"Remove"
                css {
                    padding = Padding(UiConstants.CARD_GAP_SMALL, UiConstants.CARD_GAP_SMALL)
                    fontSize = UiConstants.FONT_SIZE_SMALL
                    backgroundColor = Color("#ff2a3b")
                    color = Color("white")
                    border = Border.none
                }
                onClickFunction = { _: Event ->
                    uiScope.launch {
                        api.deletePlayer(p.id!!)
                        refreshRosterUI(rosterDiv)
                    }
                }
            }
        }
    }
}

private fun refreshTeamsListUI(divElement: HTMLDivElement, onSelectTeam: () -> Unit) {
    divElement.innerHTML = ""
    if (teamsList.isEmpty()) {
        divElement.append.p {
            +"No teams found. Create one!"
            css { color = Color("var(--text-secondary)") }
        }
    } else {
        teamsList.forEach { team ->
            renderTeamItemCard(divElement, team, onSelectTeam)
        }
    }
}

private fun renderTeamItemCard(divElement: HTMLDivElement, team: Team, onSelectTeam: () -> Unit) {
    divElement.append {
        div(classes = "game-card") {
            css {
                marginBottom = UiConstants.CARD_GAP_SMALL
                display = Display.flex
                flexDirection = FlexDirection.column
                alignItems = Align.flexStart
            }

            div {
                css {
                    fontWeight = FontWeight.bold
                    fontSize = UiConstants.FONT_SIZE_LARGE
                }
                +"${team.city} ${team.name} (${team.abbreviation})"
            }

            button(classes = "btn btn-secondary${if (selectedTeamId == team.id) " active" else ""}") {
                css {
                    marginTop = UiConstants.CARD_GAP_SMALL
                    padding = Padding(UiConstants.CARD_GAP_SMALL, UiConstants.CARD_PADDING.top)
                    fontSize = UiConstants.FONT_SIZE_MEDIUM
                }
                +(if (selectedTeamId == team.id) "Active Team" else "Select Team")
                onClickFunction = { _: Event ->
                    selectedTeamId = team.id
                    onSelectTeam()
                }
            }
        }
    }
}

private fun DIV.renderAddTeamCard(onTeamCreated: () -> Unit) {
    div(classes = "card") {
        css { marginBottom = UiConstants.CARD_MARGIN_BOTTOM }
        h2 { +"Add Team" }
        form {
            div(classes = "form-group") {
                label { +"City" }
                input(type = InputType.text, classes = "form-control") {
                    id = "team-city-input"
                    placeholder = "e.g., Boston"
                }
            }
            div(classes = "form-group") {
                label { +"Team Name" }
                input(type = InputType.text, classes = "form-control") {
                    id = "team-name-input"
                    placeholder = "e.g., Red Sox"
                }
            }
            div(classes = "form-group") {
                label { +"Abbreviation" }
                input(type = InputType.text, classes = "form-control") {
                    id = "team-abb-input"
                    placeholder = "e.g., BOS"
                }
            }
            button(classes = "btn") {
                type = ButtonType.button
                +"Create Team"
                onClickFunction = { _: Event ->
                    val inputCity = kotlinx.browser.document.getElementById("team-city-input") as? HTMLInputElement
                    val inputTName = kotlinx.browser.document.getElementById("team-name-input") as? HTMLInputElement
                    val inputAbb = kotlinx.browser.document.getElementById("team-abb-input") as? HTMLInputElement
                    handleCreateTeamSubmit(inputCity, inputTName, inputAbb, onTeamCreated)
                }
            }
        }
    }
}

private fun handleCreateTeamSubmit(
    inputCity: HTMLInputElement?,
    inputTName: HTMLInputElement?,
    inputAbb: HTMLInputElement?,
    onTeamCreated: () -> Unit,
) {
    if (inputCity != null && inputTName != null && inputAbb != null) {
        val city = inputCity.value.trim()
        val name = inputTName.value.trim()
        val abb = inputAbb.value.trim()
        if (city.isNotEmpty() && name.isNotEmpty() && abb.isNotEmpty()) {
            uiScope.launch {
                api.createTeam(Team(city = city, name = name, abbreviation = abb))
                teamsList = api.getTeams()
                inputCity.value = ""
                inputTName.value = ""
                inputAbb.value = ""
                onTeamCreated()
            }
        }
    }
}

private fun DIV.renderRosterSectionCard(team: Team, onRosterUpdated: () -> Unit) {
    div(classes = "card") {
        h2 { +"${team.city} ${team.name} Roster" }
        div {
            id = "roster-container"
            css { marginBottom = UiConstants.CARD_GAP_LARGE }
        }

        h3 { +"Add Player to Roster" }
        renderAddPlayerForm(onRosterUpdated)
    }
}

private fun DIV.renderAddPlayerForm(onPlayerAdded: () -> Unit) {
    form {
        div(classes = "form-group") {
            label { +"Player Name" }
            input(type = InputType.text, classes = "form-control") {
                id = "player-name-input"
                placeholder = "e.g., Dustin Pedroia"
            }
        }
        div(classes = "form-group") {
            label { +"Position" }
            select(classes = "form-control") {
                id = "player-pos-select"
                listOf("P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH").forEach { pos ->
                    option {
                        value = pos
                        +pos
                    }
                }
            }
        }
        div(classes = "form-group") {
            label { +"Jersey Number" }
            input(type = InputType.number, classes = "form-control") {
                id = "player-num-input"
                value = "15"
            }
        }
        renderBattingThrowingSelects()
        button(classes = "btn") {
            type = ButtonType.button
            +"Add Player"
            onClickFunction = {
                val nameIn = kotlinx.browser.document.getElementById("player-name-input") as? HTMLInputElement
                val posIn = kotlinx.browser.document.getElementById("player-pos-select") as? HTMLSelectElement
                val numIn = kotlinx.browser.document.getElementById("player-num-input") as? HTMLInputElement
                val batIn = kotlinx.browser.document.getElementById("player-bat-select") as? HTMLSelectElement
                val thrIn = kotlinx.browser.document.getElementById("player-throw-select") as? HTMLSelectElement
                handleAddPlayerSubmit(nameIn, posIn, numIn, batIn, thrIn, onPlayerAdded)
            }
        }
    }
}

private fun FORM.renderBattingThrowingSelects() {
    div(classes = "form-group") {
        label { +"Batting / Throwing Hand" }
        div {
            css {
                display = Display.flex
                gap = UiConstants.CARD_GAP
            }
            select(classes = "form-control") {
                id = "player-bat-select"
                listOf("R", "L", "S").forEach { h ->
                    option {
                        value = h
                        +"Bat: $h"
                    }
                }
            }
            select(classes = "form-control") {
                id = "player-throw-select"
                listOf("R", "L").forEach { h ->
                    option {
                        value = h
                        +"Throw: $h"
                    }
                }
            }
        }
    }
}

private fun handleAddPlayerSubmit(
    nameIn: HTMLInputElement?,
    posIn: HTMLSelectElement?,
    numIn: HTMLInputElement?,
    batIn: HTMLSelectElement?,
    thrIn: HTMLSelectElement?,
    onPlayerAdded: () -> Unit,
) {
    if (nameIn != null && posIn != null && numIn != null && batIn != null && thrIn != null) {
        val name = nameIn.value.trim()
        val pos = posIn.value
        val num = numIn.value.toIntOrNull() ?: 0
        val bat = batIn.value
        val thr = thrIn.value
        if (name.isNotEmpty()) {
            uiScope.launch {
                api.createPlayer(
                    Player(
                        teamId = selectedTeamId,
                        name = name,
                        position = pos,
                        jerseyNumber = num,
                        battingHand = bat,
                        throwingHand = thr,
                    ),
                )
                nameIn.value = ""
                onPlayerAdded()
            }
        }
    }
}
