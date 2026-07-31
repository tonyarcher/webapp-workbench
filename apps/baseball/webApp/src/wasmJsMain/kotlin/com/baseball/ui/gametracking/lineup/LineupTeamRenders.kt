package com.baseball.ui.gametracking.lineup

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
    parent.div(classes = "team-grid") {
        renderTeamColumn(isHome = false, lineupUiContext, handlers)
        renderTeamColumn(isHome = true, lineupUiContext, handlers)
    }
}

internal fun DIV.renderTeamColumn(
    isHome: Boolean,
    lineupUiContext: LineupUiContext,
    handlers: LineupPitcherChangeHandlers,
) {
    div(classes = "pitcher-card") {
        renderTeamHeader(isHome, lineupUiContext)
        renderPitcherRowIfNeeded(this, isHome, lineupUiContext, handlers)
        renderLineupHeader(this)
        val lineupInputs = if (isHome) lineupUiContext.homeLineupInputs else lineupUiContext.awayLineupInputs
        renderLineupRows(this, lineupInputs)
    }
}

internal fun DIV.renderTeamHeader(isHome: Boolean, lineupUiContext: LineupUiContext) {
    val accentClass = if (isHome) "text-accent-yellow" else "text-accent-blue"
    h2(classes = accentClass) {
        val teamLabel = if (isHome) "Home" else "Away"
        val teamName = if (isHome) lineupUiContext.homeTeamName else lineupUiContext.awayTeamName
        +"$teamLabel Team: $teamName"
    }
}

internal fun renderPitcherInputRow(
    parent: DIV,
    pitcherName: String,
    pitcherNumber: String,
    onNameChange: (String) -> Unit,
    onNumChange: (String) -> Unit,
) {
    parent.div(classes = "flex-gap-sm flex-between") {
        span {
            +"Starting Pitcher:"
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
        onChangeFunction = { event ->
            val txt = (event.target as HTMLInputElement).value
            onPitcherNumberChange(txt)
        }
    }
}
