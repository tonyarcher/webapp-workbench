package com.baseball.ui.tabs

import com.baseball.api
import com.baseball.models.Team
import com.baseball.ui.UiConstants
import com.baseball.ui.css
import com.baseball.ui.renderCurrentTab
import com.baseball.ui.selectedTeamId
import com.baseball.ui.teamsList
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import kotlinx.css.Align
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.FlexDirection
import kotlinx.css.FontWeight
import kotlinx.css.Padding
import kotlinx.css.alignItems
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexDirection
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.padding
import kotlinx.html.ButtonType
import kotlinx.html.DIV
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
