package com.baseball.ui.gametracking.lineup

import kotlinx.html.DIV
import kotlinx.html.InputType
import kotlinx.html.div
import kotlinx.html.input
import kotlinx.html.js.onChangeFunction
import kotlinx.html.option
import kotlinx.html.select
import kotlinx.html.span
import org.w3c.dom.HTMLInputElement
import org.w3c.dom.HTMLSelectElement

internal fun DIV.renderNameInput(list: MutableList<PlayerInputs>, i: Int, item: PlayerInputs) {
    input(type = InputType.text, classes = "form-control") {
        placeholder = "Enter Player Name"
        value = item.name
        onChangeFunction = { event ->
            val txt = (event.target as HTMLInputElement).value
            list[i] = list[i].copy(name = txt)
        }
    }
}

internal fun DIV.renderNumberInput(list: MutableList<PlayerInputs>, i: Int, item: PlayerInputs) {
    input(type = InputType.number, classes = "form-control") {
        placeholder = "#"
        value = item.jerseyNumber
        onChangeFunction = { event ->
            val txt = (event.target as HTMLInputElement).value
            list[i] = list[i].copy(jerseyNumber = txt)
        }
    }
}

internal fun DIV.renderPositionSelect(list: MutableList<PlayerInputs>, i: Int, item: PlayerInputs) {
    select(classes = "form-control") {
        val availablePositions = listOf("P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH")
        availablePositions.forEach { pos ->
            option {
                value = pos
                +pos
                selected = (pos == item.position)
            }
        }
        onChangeFunction = { event ->
            val selectVal = (event.target as HTMLSelectElement).value
            list[i] = list[i].copy(position = selectVal)
        }
    }
}

internal fun renderLineupHeader(parent: DIV) {
    parent.div(classes = "lineup-grid-header") {
        div { +"Slot" }
        div { +"Batter Name" }
        div { +"No." }
        div { +"Pos" }
    }
}

internal fun renderLineupRows(parent: DIV, list: MutableList<PlayerInputs>) {
    for (i in 0..8) {
        renderSingleLineupRow(parent, list, i)
    }
}

internal fun renderSingleLineupRow(
    parent: DIV,
    list: MutableList<PlayerInputs>,
    i: Int,
) {
    val item = list[i]
    parent.div(classes = "lineup-grid-row") {
        span(classes = "lineup-slot-num") {
            +"${i + 1}"
        }
        renderNameInput(list, i, item)
        renderNumberInput(list, i, item)
        renderPositionSelect(list, i, item)
    }
}
