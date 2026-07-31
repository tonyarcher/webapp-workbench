package com.baseball.ui.tabs.teams

import com.baseball.api
import com.baseball.models.Team
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.selectedTeamId
import com.baseball.ui.state.teamsList
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import kotlinx.html.ButtonType
import kotlinx.html.DIV
import kotlinx.html.FORM
import kotlinx.html.InputType
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.form
import kotlinx.html.h1
import kotlinx.html.h2
import kotlinx.html.id
import kotlinx.html.input
import kotlinx.html.js.onClickFunction
import kotlinx.html.label
import kotlinx.html.p
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLInputElement
import org.w3c.dom.events.Event

internal val uiScope = MainScope()

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

    container.append {
        div(classes = "dashboard-grid") {
            div(classes = "card") {
                h2 { +"Teams" }
                div { id = "teams-list-container" }
            }
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

    val grid = container.querySelector(".dashboard-grid") as HTMLElement
    teamsListDiv = grid.querySelector("#teams-list-container") as? HTMLDivElement
    rosterDiv = grid.querySelector("#roster-container") as? HTMLDivElement

    refreshTeamsUI()
    refreshRoster()
}

internal fun refreshRosterUI(divElement: HTMLDivElement) {
    divElement.innerHTML = ""
    val tid = selectedTeamId
    if (tid == null) {
        divElement.append {
            p(classes = "text-muted") {
                +"Select a team to view roster."
            }
        }
        return
    }

    uiScope.launch {
        val roster = api.getTeamRoster(tid)
        renderRosterContent(divElement, roster)
    }
}

private fun refreshTeamsListUI(divElement: HTMLDivElement, onSelectTeam: () -> Unit) {
    divElement.innerHTML = ""
    if (teamsList.isEmpty()) {
        divElement.append.p(classes = "text-muted") {
            +"No teams found. Create one!"
        }
    } else {
        teamsList.forEach { team ->
            renderTeamItemCard(divElement, team, onSelectTeam)
        }
    }
}

private fun renderTeamItemCard(divElement: HTMLDivElement, team: Team, onSelectTeam: () -> Unit) {
    divElement.append {
        div(classes = "game-card margin-bottom-sm") {
            div(classes = "font-bold font-large") {
                +"${team.city} ${team.name} (${team.abbreviation})"
            }
            renderTeamSelectButton(team, onSelectTeam)
        }
    }
}

private fun DIV.renderTeamSelectButton(team: Team, onSelectTeam: () -> Unit) {
    button(classes = "btn btn-secondary margin-top-xs${if (selectedTeamId == team.id) " active" else ""}") {
        +(if (selectedTeamId == team.id) "Active Team" else "Select Team")
        onClickFunction = { _: Event ->
            selectedTeamId = team.id
            onSelectTeam()
        }
    }
}

private fun DIV.renderAddTeamCard(onTeamCreated: () -> Unit) {
    div(classes = "card margin-bottom-lg") {
        h2 { +"Add Team" }
        form {
            renderTeamFormInputs()
            button(classes = "btn") {
                type = ButtonType.button
                +"Create Team"
                onClickFunction = { _: Event -> submitAddTeam(onTeamCreated) }
            }
        }
    }
}

private fun FORM.renderTeamFormInputs() {
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
}

private fun submitAddTeam(onTeamCreated: () -> Unit) {
    val inputCity = kotlinx.browser.document.getElementById("team-city-input") as? HTMLInputElement
    val inputTName = kotlinx.browser.document.getElementById("team-name-input") as? HTMLInputElement
    val inputAbb = kotlinx.browser.document.getElementById("team-abb-input") as? HTMLInputElement
    handleCreateTeamSubmit(inputCity, inputTName, inputAbb, onTeamCreated)
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
