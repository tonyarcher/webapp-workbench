package com.baseball.ui.tabs.teams

import com.baseball.api
import com.baseball.models.Player
import com.baseball.models.Team
import com.baseball.ui.core.UiConstants
import com.baseball.ui.core.css
import com.baseball.ui.core.uiScope
import com.baseball.ui.state.selectedTeamId
import kotlinx.coroutines.launch
import kotlinx.css.Border
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.Padding
import kotlinx.css.backgroundColor
import kotlinx.css.border
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.fontSize
import kotlinx.css.gap
import kotlinx.css.marginBottom
import kotlinx.css.padding
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
        p {
            +"No players on this roster yet."
            css { color = Color("var(--text-secondary)") }
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

internal fun DIV.renderRosterSectionCard(team: Team, onRosterUpdated: () -> Unit) {
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

private fun readPlayerFormInputs(): PlayerFormInputs? {
    val document = kotlinx.browser.document
    val name = (document.getElementById("player-name-input") as? HTMLInputElement) ?: return null
    val position = (document.getElementById("player-pos-select") as? HTMLSelectElement) ?: return null
    val number = (document.getElementById("player-num-input") as? HTMLInputElement) ?: return null
    val battingHand = (document.getElementById("player-bat-select") as? HTMLSelectElement) ?: return null
    val throwingHand = (document.getElementById("player-throw-select") as? HTMLSelectElement) ?: return null

    return PlayerFormInputs(name, position, number, battingHand, throwingHand)
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
