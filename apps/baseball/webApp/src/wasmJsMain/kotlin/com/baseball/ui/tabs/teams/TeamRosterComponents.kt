package com.baseball.ui.tabs.teams

import com.baseball.api
import com.baseball.models.Player
import com.baseball.models.Team
import com.baseball.ui.core.uiScope
import com.baseball.ui.state.selectedTeamId
import kotlinx.coroutines.launch
import kotlinx.html.ButtonType
import kotlinx.html.DIV
import kotlinx.html.FORM
import kotlinx.html.InputType
import kotlinx.html.TBODY
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.form
import kotlinx.html.h2
import kotlinx.html.h3
import kotlinx.html.id
import kotlinx.html.input
import kotlinx.html.js.onClickFunction
import kotlinx.html.label
import kotlinx.html.option
import kotlinx.html.p
import kotlinx.html.select
import kotlinx.html.table
import kotlinx.html.tbody
import kotlinx.html.td
import kotlinx.html.th
import kotlinx.html.thead
import kotlinx.html.tr
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLInputElement
import org.w3c.dom.HTMLSelectElement
import org.w3c.dom.events.Event

private data class PlayerFormInputs(
    val name: HTMLInputElement,
    val position: HTMLSelectElement,
    val number: HTMLInputElement,
    val battingHand: HTMLSelectElement,
    val throwingHand: HTMLSelectElement,
)

internal fun renderRosterContent(divElement: HTMLDivElement, roster: List<Player>) {
    if (roster.isEmpty()) {
        renderEmptyRosterMessage(divElement)
    } else {
        renderRosterTable(divElement, roster)
    }
}

private fun renderEmptyRosterMessage(divElement: HTMLDivElement) {
    divElement.append {
        p(classes = "text-muted") {
            +"No players on this roster yet."
        }
    }
}

private fun renderRosterTable(divElement: HTMLDivElement, roster: List<Player>) {
    divElement.append {
        div(classes = "table-container") {
            table {
                thead {
                    tr {
                        th { +"#" }; th { +"Name" }; th { +"Position" }; th { +"B/T" }; th { +"Action" }
                    }
                }
                tbody {
                    roster.forEach { p -> renderRosterRow(this, p, divElement) }
                }
            }
        }
    }
}

private fun renderRosterRow(tbody: TBODY, p: Player, rosterDiv: HTMLDivElement) {
    tbody.tr {
        td { +p.jerseyNumber.toString() }
        td { +p.name }
        td(classes = "text-accent-green") {
            +p.position
        }
        td { +"${p.battingHand}/${p.throwingHand}" }
        td {
            button(classes = "btn btn-danger font-small") {
                +"Remove"
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

internal fun DIV.renderRosterSectionCard(team: Team, onRosterUpdated: () -> Unit) {
    div(classes = "card") {
        h2 { +"${team.city} ${team.name} Roster" }
        div(classes = "margin-bottom-lg") {
            id = "roster-container"
        }

        h3 { +"Add Player to Roster" }
        renderAddPlayerForm(onRosterUpdated)
    }
}

private fun DIV.renderAddPlayerForm(onPlayerAdded: () -> Unit) {
    form {
        renderPlayerNameAndPosInputs()
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
                readPlayerFormInputs()?.let { handleAddPlayerSubmit(it, onPlayerAdded) }
            }
        }
    }
}

private fun FORM.renderPlayerNameAndPosInputs() {
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
                option { value = pos; +pos }
            }
        }
    }
}

private fun FORM.renderBattingThrowingSelects() {
    div(classes = "form-group") {
        label { +"Batting / Throwing Hand" }
        div(classes = "flex-between flex-gap-md") {
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

private fun readPlayerFormInputs(): PlayerFormInputs? {
    val document = kotlinx.browser.document
    val name = document.getElementById("player-name-input") as? HTMLInputElement
    val position = document.getElementById("player-pos-select") as? HTMLSelectElement
    val number = document.getElementById("player-num-input") as? HTMLInputElement
    val battingHand = document.getElementById("player-bat-select") as? HTMLSelectElement
    val throwingHand = document.getElementById("player-throw-select") as? HTMLSelectElement

    if (listOf(name, position, number, battingHand, throwingHand).any { it == null }) {
        return null
    }
    return PlayerFormInputs(name!!, position!!, number!!, battingHand!!, throwingHand!!)
}

private fun handleAddPlayerSubmit(
    inputs: PlayerFormInputs,
    onPlayerAdded: () -> Unit,
) {
    val name = inputs.name.value.trim()
    if (name.isEmpty()) return

    uiScope.launch {
        api.createPlayer(
            Player(
                teamId = selectedTeamId,
                name = name,
                position = inputs.position.value,
                jerseyNumber = inputs.number.value.toIntOrNull() ?: 0,
                battingHand = inputs.battingHand.value,
                throwingHand = inputs.throwingHand.value,
            ),
        )
        inputs.name.value = ""
        onPlayerAdded()
    }
}
