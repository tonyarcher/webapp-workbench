package com.baseball.ui.gametracking.lineup

import com.baseball.ui.core.css
import kotlinx.css.Align
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.FontWeight
import kotlinx.css.Padding
import kotlinx.css.alignItems
import kotlinx.css.background
import kotlinx.css.border
import kotlinx.css.borderBottom
import kotlinx.css.borderRadius
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexGrow
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.marginBottom
import kotlinx.css.padding
import kotlinx.css.paddingBottom
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.width
import kotlinx.html.DIV
import kotlinx.html.InputType
import kotlinx.html.div
import kotlinx.html.h2
import kotlinx.html.input
import kotlinx.html.js.onChangeFunction
import kotlinx.html.span
import org.w3c.dom.HTMLInputElement

internal fun renderPitcherRowIfNeeded(
    parent: DIV,
    isHome: Boolean,
    lineupUiContext: LineupUiContext,
    handlers: LineupPitcherChangeHandlers,
) {
    if (!lineupUiContext.useDh) return
    val pitcherName = if (isHome) lineupUiContext.homePitcherName else lineupUiContext.awayPitcherName
    val pitcherNumber = if (isHome) lineupUiContext.homePitcherNumber else lineupUiContext.awayPitcherNumber
    val onName = if (isHome) handlers.onHomePitcherNameChange else handlers.onAwayPitcherNameChange
    val onNum = if (isHome) handlers.onHomePitcherNumberChange else handlers.onAwayPitcherNumberChange
    renderPitcherInputRow(parent, pitcherName, pitcherNumber, onName, onNum)
}

internal fun renderTeamGrid(
    parent: DIV,
    lineupUiContext: LineupUiContext,
    handlers: LineupPitcherChangeHandlers,
) {
    parent.div {
        css {
            display = Display.grid
            put("grid-template-columns", "1fr 1fr")
            gap = 2.rem
            marginBottom = 2.rem
        }
        renderTeamColumn(isHome = false, lineupUiContext, handlers)
        renderTeamColumn(isHome = true, lineupUiContext, handlers)
    }
}

internal fun DIV.renderTeamColumn(
    isHome: Boolean,
    lineupUiContext: LineupUiContext,
    handlers: LineupPitcherChangeHandlers,
) {
    div {
        css {
            background = "rgba(255, 255, 255, 0.02)"
            padding = Padding(1.5.rem)
            borderRadius = 12.px
            border = Border(1.px, BorderStyle.solid, Color("rgba(255,255,255,0.05)"))
        }
        renderTeamHeader(isHome, lineupUiContext)
        renderPitcherRowIfNeeded(this, isHome, lineupUiContext, handlers)
        renderLineupHeader(this)
        val lineupInputs = if (isHome) lineupUiContext.homeLineupInputs else lineupUiContext.awayLineupInputs
        renderLineupRows(this, lineupInputs)
    }
}

internal fun DIV.renderTeamHeader(isHome: Boolean, lineupUiContext: LineupUiContext) {
    h2 {
        val teamLabel = if (isHome) "Home" else "Away"
        val teamName = if (isHome) lineupUiContext.homeTeamName else lineupUiContext.awayTeamName
        +"$teamLabel Team: $teamName"
        css {
            color = Color(if (isHome) "var(--accent-yellow)" else "var(--accent-blue)")
            marginBottom = 1.rem
        }
    }
}

internal fun renderPitcherInputRow(
    parent: DIV,
    pitcherName: String,
    pitcherNumber: String,
    onNameChange: (String) -> Unit,
    onNumChange: (String) -> Unit,
) {
    parent.div {
        css {
            display = Display.flex
            gap = 0.5.rem
            marginBottom = 1.25.rem
            paddingBottom = 1.rem
            borderBottom = Border(1.px, BorderStyle.dashed, Color("rgba(255,255,255,0.1)"))
            alignItems = Align.center
        }
        span {
            +"Starting Pitcher:"
            css {
                fontWeight = FontWeight.bold
                width = 100.px
            }
        }
        renderPitcherNameInput(pitcherName, onNameChange)
        renderPitcherNumberInput(pitcherNumber, onNumChange)
    }
}

internal fun DIV.renderPitcherNameInput(
    currentValue: String,
    onPitcherNameChange: (String) -> Unit
) {
    input(type = InputType.text, classes = "form-control") {
        placeholder = "Pitcher Name"
        value = currentValue
        css {
            flexGrow = 1.0
        }
        onChangeFunction = { event ->
            val txt = (event.target as HTMLInputElement).value
            onPitcherNameChange(txt)
        }
    }
}

internal fun DIV.renderPitcherNumberInput(
    currentValue: String,
    onPitcherNumberChange: (String) -> Unit
) {
    input(type = InputType.number, classes = "form-control") {
        placeholder = "No."
        value = currentValue
        css {
            width = 60.px
        }
        onChangeFunction = { event ->
            val txt = (event.target as HTMLInputElement).value
            onPitcherNumberChange(txt)
        }
    }
}

