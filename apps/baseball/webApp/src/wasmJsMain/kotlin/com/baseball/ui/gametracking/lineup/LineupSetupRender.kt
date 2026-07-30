package com.baseball.ui.gametracking.lineup

import com.baseball.ui.core.css
import kotlinx.css.Align
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Cursor
import kotlinx.css.Display
import kotlinx.css.FontWeight
import kotlinx.css.JustifyContent
import kotlinx.css.LinearDimension
import kotlinx.css.Overflow
import kotlinx.css.Padding
import kotlinx.css.Position
import kotlinx.css.TextAlign
import kotlinx.css.alignItems
import kotlinx.css.background
import kotlinx.css.border
import kotlinx.css.borderBottom
import kotlinx.css.borderRadius
import kotlinx.css.color
import kotlinx.css.cursor
import kotlinx.css.display
import kotlinx.css.flexGrow
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.height
import kotlinx.css.justifyContent
import kotlinx.css.left
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.maxWidth
import kotlinx.css.overflowY
import kotlinx.css.padding
import kotlinx.css.paddingBottom
import kotlinx.css.pct
import kotlinx.css.position
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.textAlign
import kotlinx.css.top
import kotlinx.css.width
import kotlinx.css.zIndex
import kotlinx.html.DIV
import kotlinx.html.InputType
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h1
import kotlinx.html.h2
import kotlinx.html.input
import kotlinx.html.js.div
import kotlinx.html.js.onChangeFunction
import kotlinx.html.js.onClickFunction
import kotlinx.html.label
import kotlinx.html.option
import kotlinx.html.select
import kotlinx.html.span
import org.w3c.dom.HTMLElement
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

internal fun renderLineupModalHeader(parent: DIV, validationError: String?) {
    parent.h1 {
        +"Game Roster & Lineup Setup"
        css {
            textAlign = TextAlign.center
            marginBottom = 1.5.rem
        }
    }
    renderValidationErrorBanner(parent, validationError)
}

internal fun renderOverlayContainer(parent: HTMLElement, content: DIV.() -> Unit) {
    parent.append {
        div {
            css {
                position = Position.fixed
                top = 0.px
                left = 0.px
                width = LinearDimension("100vw")
                height = LinearDimension("100vh")
                background = "rgba(10, 15, 30, 0.8)"
                put("backdrop-filter", "blur(12px)")
                display = Display.flex
                alignItems = Align.flexStart
                justifyContent = JustifyContent.center
                zIndex = 10000
                overflowY = Overflow.auto
                padding = Padding(2.rem, 1.rem)
            }
            content()
        }
    }
}

internal fun DIV.renderModalContent(
    useDh: Boolean,
    validationError: String?,
    lineupUiContext: LineupUiContext,
    handlers: LineupPitcherChangeHandlers,
    callbacks: LineupCallbacks,
) {
    div(classes = "lineup-modal-content card") {
        css {
            width = 100.pct
            maxWidth = 1000.px
            padding = Padding(2.rem)
            put("box-shadow", "0 10px 40px rgba(0,0,0,0.5)")
        }
        renderLineupModalHeader(this, validationError)
        renderConfigurationBar(this, useDh, callbacks.onDhToggle, callbacks.onLoadDefault, callbacks.onRandom)
        renderTeamGrid(this, lineupUiContext, handlers)
        renderFooterButtons(this, callbacks.onBack, callbacks.onStartSave)
    }
}

internal fun renderValidationErrorBanner(parent: DIV, errorMsg: String?) {
    errorMsg ?: return
    parent.div(classes = "server-error-banner") {
        +errorMsg
        css {
            marginBottom = 1.rem
        }
    }
}

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

internal fun renderConfigurationBar(
    parent: DIV,
    useDh: Boolean,
    onDhToggle: (Boolean) -> Unit,
    onLoadDefault: () -> Unit,
    onRandom: () -> Unit
) {
    parent.div {
        css {
            display = Display.flex; justifyContent = JustifyContent.spaceBetween; alignItems = Align.center
            marginBottom = 1.5.rem; background = "rgba(255, 255, 255, 0.03)"
            padding = Padding(1.rem); borderRadius = 8.px
        }
        renderDhToggle(useDh, onDhToggle)
        renderConfigActionButtons(parent, onLoadDefault, onRandom)
    }
}

internal fun DIV.renderDhToggle(useDh: Boolean, onToggle: (Boolean) -> Unit) {
    label {
        css {
            display = Display.flex
            alignItems = Align.center
            gap = 0.5.rem
            cursor = Cursor.pointer
        }
        input(type = InputType.checkBox) {
            checked = useDh
            onChangeFunction = { event ->
                onToggle((event.target as HTMLInputElement).checked)
            }
        }
        span {
            +"Enable Designated Hitter (DH)"
            css {
                fontWeight = FontWeight.bold
            }
        }
    }
}

internal fun renderConfigActionButtons(parent: DIV, onLoadDefault: () -> Unit, onRandom: () -> Unit) {
    parent.div {
        css {
            display = Display.flex
            gap = 0.75.rem
        }
        button(classes = "btn btn-secondary") {
            +"Load Default Roster"
            onClickFunction = { onLoadDefault() }
        }
        button(classes = "btn btn-action") {
            +"Populate Random Example Data"
            css {
                put("background", "linear-gradient(135deg, #3b82f6, #8b5cf6)")
            }
            onClickFunction = { onRandom() }
        }
    }
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

internal fun renderFooterButtons(parent: DIV, onBack: () -> Unit, onStartSave: () -> Unit) {
    parent.div {
        css {
            display = Display.flex
            justifyContent = JustifyContent.spaceBetween
            marginTop = 1.5.rem
        }
        button(classes = "btn btn-secondary") {
            +"← Go Back to Welcome"
            onClickFunction = { onBack() }
        }
        button(classes = "btn btn-primary") {
            +"⚾ Start & Save Game"
            onClickFunction = { onStartSave() }
        }
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
