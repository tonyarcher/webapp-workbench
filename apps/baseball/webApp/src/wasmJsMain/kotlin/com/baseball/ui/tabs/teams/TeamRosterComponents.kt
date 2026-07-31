package com.baseball.ui.tabs.teams

import com.baseball.api
import com.baseball.models.Player
import com.baseball.models.Team
import com.baseball.ui.core.uiScope
import com.baseball.ui.state.selectedTeamId
import kotlinx.browser.document
import kotlinx.coroutines.launch
import kotlinx.html.ButtonType
import kotlinx.html.DIV
import kotlinx.html.FORM
import kotlinx.html.InputType
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
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLInputElement
import org.w3c.dom.HTMLSelectElement
import org.w3c.dom.events.Event

@Serializable
private data class PlayerJs(
    val id: Long,
    val name: String,
    val position: String,
    val jerseyNumber: Int,
    val battingHand: String,
    val throwingHand: String,
)

private data class PlayerFormInputs(
    val name: HTMLInputElement,
    val position: HTMLSelectElement,
    val number: HTMLInputElement,
    val battingHand: HTMLSelectElement,
    val throwingHand: HTMLSelectElement,
)

internal fun DIV.renderRosterSectionCard(team: Team, onRosterUpdated: () -> Unit) {
    div(classes = "card margin-top-lg") {
        h2 { +"Roster: ${team.name}" }
        div { id = "roster-container" }
        renderAddPlayerForm(this, onRosterUpdated)
    }
}

internal fun renderRosterContent(divElement: HTMLDivElement, roster: List<Player>) {
    if (roster.isEmpty()) {
        divElement.append { p(classes = "text-muted") { +"No players on this roster yet." } }
    } else {
        renderRosterTable(divElement, roster)
    }
}

private fun renderRosterTable(divElement: HTMLDivElement, roster: List<Player>) {
    val players = roster.map { p ->
        PlayerJs(
            id = p.id ?: 0L,
            name = p.name,
            position = p.position,
            jerseyNumber = p.jerseyNumber,
            battingHand = p.battingHand,
            throwingHand = p.throwingHand,
        )
    }

    divElement.append { div { id = "roster-table-mount-point" } }

    val mountPoint = document.getElementById("roster-table-mount-point") as? HTMLElement
    if (mountPoint != null) {
        mountPoint.innerHTML = ""
        val table = document.createElement("baseball-roster-table")
        val jsonString = Json.encodeToString(players)
        table.setAttribute("players-json", jsonString)
        mountPoint.appendChild(table)
    }
}

internal fun renderAddPlayerForm(parent: DIV, onPlayerAdded: () -> Unit) {
    parent.div(classes = "card margin-top-lg") {
        h3 { +"Add New Player" }
        form {
            id = "add-player-form"
            renderFormFields()
            div(classes = "margin-top-md") {
                button(classes = "btn btn-primary", type = ButtonType.button) {
                    +"Save Player"
                    onClickFunction = { e: Event ->
                        e.preventDefault()
                        readPlayerFormInputs()?.let { inputs -> handleAddPlayerSubmit(inputs, onPlayerAdded) }
                    }
                }
            }
        }
    }
}

private fun FORM.renderFormFields() {
    div(classes = "form-group") {
        label { +"Player Name" }
        input(type = InputType.text, classes = "form-control") { id = "player-name-input" }
    }
    renderSelectRow1()
    renderSelectRow2()
}

private fun FORM.renderSelectRow1() {
    div(classes = "flex-gap-md") {
        div(classes = "form-group flex-grow") {
            label { +"Position" }
            select(classes = "form-control") {
                id = "player-pos-select"
                listOf("P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH").forEach { pos ->
                    option { value = pos; +pos }
                }
            }
        }
        div(classes = "form-group flex-grow") {
            label { +"Jersey Number" }
            input(type = InputType.number, classes = "form-control") { id = "player-num-input"; value = "1" }
        }
    }
}

private fun FORM.renderSelectRow2() {
    div(classes = "flex-gap-md margin-top-sm") {
        div(classes = "form-group flex-grow") {
            label { +"Batting Hand" }
            select(classes = "form-control") {
                id = "player-bat-select"
                listOf("Right", "Left", "Switch").forEach { h -> option { value = h; +"Bat: $h" } }
            }
        }
        div(classes = "form-group flex-grow") {
            label { +"Throwing Hand" }
            select(classes = "form-control") {
                id = "player-throw-select"
                listOf("Right", "Left").forEach { h -> option { value = h; +"Throw: $h" } }
            }
        }
    }
}

private fun readPlayerFormInputs(): PlayerFormInputs? {
    val doc = kotlinx.browser.document
    val name = doc.getElementById("player-name-input") as? HTMLInputElement
    val position = doc.getElementById("player-pos-select") as? HTMLSelectElement
    val number = doc.getElementById("player-num-input") as? HTMLInputElement
    val battingHand = doc.getElementById("player-bat-select") as? HTMLSelectElement
    val throwingHand = doc.getElementById("player-throw-select") as? HTMLSelectElement

    if (listOf(name, position, number, battingHand, throwingHand).any { it == null }) return null
    return PlayerFormInputs(name!!, position!!, number!!, battingHand!!, throwingHand!!)
}

private fun handleAddPlayerSubmit(inputs: PlayerFormInputs, onPlayerAdded: () -> Unit) {
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
            )
        )
        onPlayerAdded()
    }
}
