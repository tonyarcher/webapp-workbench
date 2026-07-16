package com.baseball.ui.tabs

import com.baseball.BaseballConstants
import com.baseball.UiConstants
import com.baseball.api
import com.baseball.models.*
import org.w3c.dom.*
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.css.*
import com.baseball.ui.*

internal fun renderTeamsTab(container: HTMLElement) {
    container.h1 { +"Teams & Rosters" }

    var teamsListDiv: HTMLDivElement? = null
    var rosterDiv: HTMLDivElement? = null
    var inputCity: HTMLInputElement? = null
    var inputTName: HTMLInputElement? = null
    var inputAbb: HTMLInputElement? = null
    var inputPName: HTMLInputElement? = null
    var inputPos: HTMLSelectElement? = null
    var inputNum: HTMLInputElement? = null
    var selectBat: HTMLSelectElement? = null
    var selectThrow: HTMLSelectElement? = null

    fun refreshRoster() {
        val divElement = rosterDiv ?: return
        divElement.innerHTML = ""
        val tid = selectedTeamId
        if (tid == null) {
            divElement.p {
                +"Select a team to view roster."
                css { color = Color("var(--text-secondary)") }
            }
            return
        }

        launch {
            val roster = api.getTeamRoster(tid)
            if (roster.isEmpty()) {
                divElement.p {
                    +"No players on this roster yet."
                    css { color = Color("var(--text-secondary)") }
                }
            } else {
                divElement.div(classes = "table-container") {
                    table {
                        thead {
                            tr {
                                th { +"#" }
                                th { +"Name" }
                                th { +"Position" }
                                th { +"B/T" }
                            }
                        }
                        tbody {
                            roster.forEach { p ->
                                tr {
                                    td { +p.jerseyNumber.toString() }
                                    td { +p.name }
                                    td {
                                        +p.position
                                        css { color = Color("var(--accent-green)") }
                                    }
                                    td { +"${p.battingHand}/${p.throwingHand}" }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fun refreshTeamsUI() {
        val divElement = teamsListDiv ?: return
        divElement.innerHTML = ""
        if (teamsList.isEmpty()) {
            divElement.p {
                +"No teams found. Create one!"
                css { color = Color("var(--text-secondary)") }
            }
        } else {
            teamsList.forEach { team ->
                divElement.div(classes = "game-card") {
                    css {
                        marginBottom = 0.75.rem
                        display = Display.flex
                        flexDirection = FlexDirection.column
                        alignItems = Align.flexStart
                    }

                    div {
                        css {
                            fontWeight = FontWeight.bold
                            fontSize = 1.1.rem
                        }
                        +"${team.city} ${team.name} (${team.abbreviation})"
                    }

                    button(classes = "btn btn-secondary${if (selectedTeamId == team.id) " active" else ""}") {
                        css {
                            marginTop = 0.5.rem
                            padding = Padding(0.25.rem, 0.75.rem)
                            fontSize = 0.85.rem
                        }
                        +(if (selectedTeamId == team.id) "Active Team" else "Select Team")
                        onClickFunction = {
                            selectedTeamId = team.id
                            refreshTeamsUI()
                            refreshRoster()
                            renderCurrentTab()
                        }
                    }
                }
            }
        }
    }

    val grid = container.div(classes = "dashboard-grid") {
        div(classes = "card") {
            h2 { +"Teams" }
            div {
                id = "teams-list-container"
            }
        }

        div {
            div(classes = "card") {
                css { marginBottom = 2.rem }
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
                        onClickFunction = {
                            val inCity = inputCity
                            val inTName = inputTName
                            val inAbb = inputAbb
                            if (inCity != null && inTName != null && inAbb != null) {
                                val city = inCity.value.trim()
                                val name = inTName.value.trim()
                                val abb = inAbb.value.trim()
                                if (city.isNotEmpty() && name.isNotEmpty() && abb.isNotEmpty()) {
                                    launch {
                                        api.createTeam(Team(city = city, name = name, abbreviation = abb))
                                        teamsList = api.getTeams()
                                        inCity.value = ""
                                        inTName.value = ""
                                        inAbb.value = ""
                                        refreshTeamsUI()
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (selectedTeamId != null) {
                val team = teamsList.find { it.id == selectedTeamId }
                div(classes = "card") {
                    h2 { +"${team?.city} ${team?.name} Roster" }
                    div {
                        id = "roster-container"
                        css { marginBottom = 1.5.rem }
                    }

                    h3 { +"Add Player to Roster" }
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
                        div(classes = "form-group") {
                            label { +"Batting / Throwing Hand" }
                            div {
                                css {
                                    display = Display.flex
                                    gap = 1.rem
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
                        button(classes = "btn") {
                            type = ButtonType.button
                            +"Add Player"
                            onClickFunction = {
                                val nameIn = inputPName
                                val posIn = inputPos
                                val numIn = inputNum
                                val batIn = selectBat
                                val thrIn = selectThrow
                                if (nameIn != null && posIn != null && numIn != null && batIn != null && thrIn != null) {
                                    val name = nameIn.value.trim()
                                    val pos = posIn.value
                                    val num = numIn.value.toIntOrNull() ?: 0
                                    val bat = batIn.value
                                    val thr = thrIn.value
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
                                            nameIn.value = ""
                                            refreshRoster()
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

    teamsListDiv = grid.querySelector("#teams-list-container") as? HTMLDivElement
    rosterDiv = grid.querySelector("#roster-container") as? HTMLDivElement
    inputCity = grid.querySelector("#team-city-input") as? HTMLInputElement
    inputTName = grid.querySelector("#team-name-input") as? HTMLInputElement
    inputAbb = grid.querySelector("#team-abb-input") as? HTMLInputElement
    inputPName = grid.querySelector("#player-name-input") as? HTMLInputElement
    inputPos = grid.querySelector("#player-pos-select") as? HTMLSelectElement
    inputNum = grid.querySelector("#player-num-input") as? HTMLInputElement
    selectBat = grid.querySelector("#player-bat-select") as? HTMLSelectElement
    selectThrow = grid.querySelector("#player-throw-select") as? HTMLSelectElement

    refreshTeamsUI()
    refreshRoster()
}
