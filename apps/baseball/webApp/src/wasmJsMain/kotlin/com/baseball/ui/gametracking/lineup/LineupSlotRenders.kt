package com.baseball.ui.gametracking.lineup

import com.baseball.ui.core.css
import kotlinx.css.Align
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.FontWeight
import kotlinx.css.Padding
import kotlinx.css.TextAlign
import kotlinx.css.alignItems
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.marginBottom
import kotlinx.css.padding
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.textAlign
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
    parent.div {
        css {
            display = Display.grid
            put("grid-template-columns", "40px 1fr 60px 80px")
            gap = 0.5.rem
            marginBottom = 0.5.rem
            padding = Padding(0.px, 0.5.rem)
            fontWeight = FontWeight.bold
            color = Color("rgba(255,255,255,0.6)")
        }
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
    parent.div {
        css {
            display = Display.grid
            put("grid-template-columns", "40px 1fr 60px 80px")
            gap = 0.5.rem
            marginBottom = 0.5.rem
            alignItems = Align.center
        }
        span {
            +"${i + 1}"
            css {
                textAlign = TextAlign.center
                color = Color("rgba(255,255,255,0.4)")
                fontWeight = FontWeight.bold
            }
        }
        renderNameInput(list, i, item)
        renderNumberInput(list, i, item)
        renderPositionSelect(list, i, item)
    }
}
